import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { History, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';

// Redux Actions
import { 
  fetchChats, fetchContext, loadChat, fetchMoreHistory, sendMessage, 
  resetResearch, addLocalMessage, appendStreamBatch, setShowModal,
  setDisease, setLocation, toggleSidebar, claimChats, completeStreaming
} from './store/chatSlice';
import { fetchProfile, logout } from './store/authSlice';

// Components
import AuthModal from './components/AuthModal';
import UploadModal from './components/UploadModal';
import Sidebar from './components/chat/Sidebar';
import ResearchHeader from './components/chat/ResearchHeader';
import ChatView from './components/chat/ChatView';
import MainInput from './components/chat/MainInput';
import FocusModal from './components/chat/FocusModal';

const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
  withCredentials: true
});

const spring = { type: 'spring', stiffness: 380, damping: 30 };

/* ─── Main View Logic (previously App) ─── */
function MainApp() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { chatId: urlChatId } = useParams();
  
  const { 
    messages, chats, activeChatId, disease, location, 
    loading, isStreaming, activeStreamIds, processingChatIds, progress, showModal, sidebarOpen,
    hasMoreHistory, isFetchingMore
  } = useSelector(state => state.chat);
  const { user, isAuthenticated } = useSelector(state => state.auth);
  const isChatBusy = isStreaming || processingChatIds.includes(activeChatId) || (loading && !activeChatId);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [analyzedData, setAnalyzedData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const chatEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);
  const chunkBufferRef = useRef({});
  const topSentinelRef = useRef(null);
  const scrollHeightRef = useRef(0);

  const scrollToBottom = (behavior = 'smooth') => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  // SCROLL STABILIZATION
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    
    if (isFetchingMore) {
      scrollHeightRef.current = scrollHeight;
      return; 
    }

    if (scrollHeightRef.current > 0) {
      const delta = scrollHeight - scrollHeightRef.current;
      scrollContainerRef.current.scrollTop = scrollTop + delta;
      scrollHeightRef.current = 0;
      return;
    }

    const isStationary = scrollHeight - scrollTop - clientHeight < 150; 
    if (isStationary || messages.length <= 1) {
      scrollToBottom(messages.length <= 2 ? 'auto' : 'smooth');
    }
  }, [messages.length, messages[messages.length-1]?.content, isChatBusy, progress.length, isFetchingMore]);

  // SYNC URL TO REDUX STATE
  useEffect(() => {
    if (urlChatId && urlChatId !== activeChatId) {
      dispatch(loadChat(urlChatId));
    }
  }, [urlChatId, dispatch, activeChatId]);

  // STAGGERED INITIAL BOOT
  useEffect(() => {
    const bootSequence = async () => {
      await dispatch(fetchProfile());
      await dispatch(fetchChats());
      dispatch(fetchContext());
      if (isAuthenticated) {
        await dispatch(claimChats());
        dispatch(fetchChats());
      }
    };
    bootSequence();
  }, [dispatch]); // only once on mount

  // INFINITE SCROLL OBSERVER
  useEffect(() => {
    if (!hasMoreHistory || isFetchingMore || !activeChatId) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        const earliestId = messages[0]?.id;
        if (earliestId && !earliestId.startsWith('streaming')) {
          dispatch(fetchMoreHistory({ chatId: activeChatId, cursorId: earliestId }));
        }
      }
    }, { threshold: 0.1 });

    if (topSentinelRef.current) observer.observe(topSentinelRef.current);
    return () => observer.disconnect();
  }, [dispatch, activeChatId, hasMoreHistory, isFetchingMore, messages]);

  // SOCKET STREAMING ENGINE
  useEffect(() => {
    socket.on('chat:chunk', ({ chatId, chunk }) => {
      if (!chunkBufferRef.current[chatId]) chunkBufferRef.current[chatId] = "";
      chunkBufferRef.current[chatId] += chunk;
    });

    const flushInterval = setInterval(() => {
      const buffer = chunkBufferRef.current;
      if (Object.keys(buffer).length > 0) {
        dispatch(appendStreamBatch(buffer));
        chunkBufferRef.current = {};
      }
    }, 150);

    socket.on('chat:done', (data) => {
      const buffer = chunkBufferRef.current;
      if (buffer[data.chatId]) {
        dispatch(appendStreamBatch({ [data.chatId]: buffer[data.chatId] }));
        delete chunkBufferRef.current[data.chatId];
      }
      dispatch(completeStreaming(data));
      dispatch(fetchChats());
    });

    return () => {
      socket.off('chat:chunk');
      socket.off('chat:done');
      clearInterval(flushInterval);
    };
  }, [dispatch]);

  const handleSend = async (e, textOverride) => {
    if (e) e.preventDefault();
    const messageText = textOverride || input;
    if (!messageText.trim() || loading || isStreaming) return; 
    if (!disease) { dispatch(setShowModal(true)); return; }

    dispatch(addLocalMessage({ 
      role: 'user', 
      content: messageText,
      metadata: analyzedData ? { patientContext: analyzedData } : null
    }));
    
    if (!textOverride) {
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
    inputRef.current?.focus();

    const result = await dispatch(sendMessage({
      chatId: activeChatId,
      message: messageText,
      context: { disease, location, intent: 'Patient Inquiry' },
      patientData: analyzedData
    })).unwrap();

    if (!activeChatId && result.chatId) {
      navigate(`/research/${result.chatId}`);
    }
  };

  const handleStop = () => {
    if (activeChatId) socket.emit('chat:stop', { chatId: activeChatId });
  };

  const handleFileUpload = async (file) => {
    setIsUploading(true);
    setSelectedFile(file);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post('/api/docs/analyze', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAnalyzedData(res.data.summary);
    } catch (err) {
      console.error('Upload failed', err);
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
      setIsUploadModalOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      <Sidebar 
        sidebarOpen={sidebarOpen}
        chats={chats}
        urlChatId={urlChatId}
        activeStreamIds={activeStreamIds}
        isAuthenticated={isAuthenticated}
        user={user}
        onNewResearch={() => { dispatch(resetResearch()); navigate('/'); }}
        onChatClick={(id) => navigate(`/research/${id}`)}
        onLogout={() => dispatch(logout())}
        onLogin={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-1 flex flex-col relative h-full bg-white overflow-hidden shadow-2xl">
        <ResearchHeader 
          isChatBusy={isChatBusy}
          disease={disease}
          onToggleSidebar={() => dispatch(toggleSidebar())}
          onSetFocus={() => dispatch(setShowModal(true))}
        />

        <ChatView 
          messages={messages}
          activeChatId={activeChatId}
          disease={disease}
          loading={loading}
          isStreaming={isStreaming}
          isChatBusy={isChatBusy}
          progress={progress}
          hasMoreHistory={hasMoreHistory}
          isFetchingMore={isFetchingMore}
          onSuggestion={(s) => handleSend(null, s)}
          scrollContainerRef={scrollContainerRef}
          topSentinelRef={topSentinelRef}
          chatEndRef={chatEndRef}
        />

        <MainInput 
          input={input}
          setInput={setInput}
          isChatBusy={isChatBusy}
          isUploading={isUploading}
          isAuthenticated={isAuthenticated}
          selectedFile={selectedFile}
          analyzedData={analyzedData}
          disease={disease}
          onSend={handleSend}
          onStop={handleStop}
          onAttachClick={() => isAuthenticated ? setIsUploadModalOpen(true) : setIsAuthModalOpen(true)}
          onFileClear={() => { setSelectedFile(null); setAnalyzedData(null); }}
          inputRef={inputRef}
        />
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
        onUpload={handleFileUpload} 
      />
      <AnimatePresence>
        {showModal && (
          <FocusModal 
            isOpen={showModal}
            onClose={() => dispatch(setShowModal(false))}
            disease={disease}
            setDisease={(d) => dispatch(setDisease(d))}
            location={location}
            setLocation={(l) => dispatch(setLocation(l))}
            onStart={() => dispatch(setShowModal(false))}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/research/:chatId" element={<MainApp />} />
    </Routes>
  );
}
