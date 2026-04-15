import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import {
  Plus, MapPin, ExternalLink, Loader2, Heart, Globe, CheckCircle2,
  User, History, Info, ArrowRight, ShieldCheck, Sparkles, X,
  ChevronRight, Lock, ChevronDown, Square, Paperclip, FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { 
  fetchChats, fetchContext, loadChat, sendMessage, addProgress, 
  resetResearch, addLocalMessage, appendStreamChunk, setShowModal,
  setDisease, setLocation, toggleSidebar, claimChats, completeStreaming
} from './store/chatSlice';
import { fetchProfile, logout } from './store/authSlice';
import AuthModal from './components/AuthModal';

const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
  withCredentials: true
});

/* ─── Reusable spring config ─── */
const spring = { type: 'spring', stiffness: 380, damping: 30 };
const softSpring = { type: 'spring', stiffness: 200, damping: 26 };

/* ─── AnimatedButton ─── */
const AnimatedButton = React.memo(({ children, className = '', disabled = false, onClick, type = 'button' }) => (
  <motion.button
    type={type}
    onClick={onClick}
    disabled={disabled}
    whileHover={!disabled ? { scale: 1.025 } : {}}
    whileTap={!disabled ? { scale: 0.96 } : {}}
    transition={spring}
    className={className}
  >
    {children}
  </motion.button>
));

/* ─── Pulse dot ─── */
const PulseDot = React.memo(() => (
  <span className="relative flex h-2.5 w-2.5">
    <motion.span
      className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
      animate={{ scale: [1, 1.8, 1], opacity: [0.75, 0, 0.75] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
  </span>
));

/* ─── Typing dots loader ─── */
const TypingDots = React.memo(() => (
  <div className="flex gap-1.5 items-center px-2 py-1">
    {[0, 1, 2].map(i => (
      <motion.span
        key={i}
        className="w-2 h-2 rounded-full bg-blue-400"
        animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
      />
    ))}
  </div>
));

/* ─── Source card ─── */
const SourceCard = React.memo(({ source, index }) => (
  <motion.a
    href={source.url}
    target="_blank"
    rel="noreferrer"
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...softSpring, delay: index * 0.07 }}
    whileHover={{ y: -1.5, boxShadow: '0 8px 30px rgba(59,130,246,0.12)' }}
    className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 transition-colors group flex flex-col gap-3 cursor-pointer"
    style={{ textDecoration: 'none' }}
  >
    <div className="flex justify-between items-start">
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
        source.type === 'Trial' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
      }`}>
        {source.platform}
      </span>
      <motion.div className="text-slate-300 group-hover:text-blue-500 transition-colors" whileHover={{ rotate: -10, scale: 1.05 }} transition={spring}>
        <ExternalLink size={14} />
      </motion.div>
    </div>
    <p className="text-sm font-semibold leading-snug text-slate-800 line-clamp-2 flex-1">
      {source.title}
    </p>
    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold uppercase tracking-wide">
      <Globe size={11} />
      <span>{source.year}</span>
      <span className="truncate">• {source.authors || source.location}</span>
    </div>
  </motion.a>
));

/* ─── Message Item ─── */
const MessageItem = React.memo(({ msg }) => {
  const [showSources, setShowSources] = useState(false);
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...softSpring, delay: 0.02 }}
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-4 w-full`}
    >
      <div className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} w-full`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-2xl flex items-center justify-center shadow-sm ${
          isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-blue-50 to-white border border-blue-100'
        }`}>
          {isUser ? <User size={15} className="text-white" /> : <Heart size={15} className="text-blue-500 fill-blue-100" />}
        </div>

        <motion.div className={`max-w-[85%] sm:max-w-[75%] px-5 py-4 rounded-2xl ${
          isUser ? 'bg-blue-600 text-white rounded-br-sm shadow-lg shadow-blue-100' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
        }`}>
          {isUser && msg.metadata && msg.metadata.patientContext && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 mb-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-1.5 w-fit">
              <FileText size={12} className="text-blue-100" />
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-50">Lab Results Integrated</span>
            </motion.div>
          )}

          <div className={`prose max-w-none text-[15px] leading-relaxed ${isUser ? 'prose-invert' : 'prose-slate'}`}>
            <ReactMarkdown components={{
              a: ({ node, ...props }) => (
                <motion.a {...props} whileHover={{ color: '#2563eb' }} className="inline-flex items-center gap-0.5 font-bold text-blue-600 underline underline-offset-4 decoration-blue-200 hover:decoration-blue-500 transition-all cursor-alias mx-0.5" target="_blank" rel="noreferrer" />
              )
            }}>
              {msg.content.replace(/^(#+)([^#\s])/gm, '$1 $2')}
            </ReactMarkdown>
          </div>
        </motion.div>
      </div>

      {!isUser && msg.sources && msg.sources.length > 0 && (
        <motion.button onClick={() => setShowSources(!showSources)} whileHover={{ x: 4, color: '#2563eb' }} className="ml-10 cursor-pointer flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors group">
          <div className="w-5 h-5 rounded-lg bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
            <motion.div animate={{ rotate: showSources ? 90 : 0 }}><ChevronRight size={10} /></motion.div>
          </div>
          {showSources ? 'Hide References' : `View ${msg.sources.length} References`}
        </motion.button>
      )}

      <AnimatePresence>
        {showSources && msg.sources && msg.sources.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="w-full max-w-[92%] self-start overflow-hidden ml-10 p-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {msg.sources.map((source, si) => <SourceCard key={si} source={source} index={si} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

/* ─── Sidebar chat item ─── */
const ChatItem = React.memo(({ chat, active, streaming, onClick }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ x: 3 }}
    whileTap={{ scale: 0.98 }}
    transition={spring}
    className={`w-full cursor-pointer p-3.5 rounded-xl flex items-center gap-3 transition-colors text-left ${
      active ? 'bg-white border border-slate-200 shadow-sm' : 'hover:bg-white/60 border border-transparent'
    }`}
  >
    <motion.div className={`p-2 rounded-lg flex-shrink-0 ${active ? 'bg-blue-50 text-blue-600' : 'bg-slate-200/50 text-slate-400'}`}>
      <Info size={14} />
    </motion.div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`block truncate text-sm font-semibold ${active ? 'text-blue-900' : 'text-slate-600'}`}>
          {chat.title}
        </span>
        {streaming && <PulseDot />}
      </div>
      <span className="text-[10px] text-slate-400 font-medium">
        {new Date(chat.createdAt).toLocaleDateString()}
      </span>
    </div>
    {active && <motion.div layoutId="activeDot" className="flex-shrink-0"><ChevronRight size={14} className="text-blue-400" /></motion.div>}
  </motion.button>
));

/* ─── Empty state ─── */
const EmptyState = React.memo(({ disease, onSuggestion }) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={softSpring} className="h-[60vh] flex flex-col items-center justify-center text-center gap-8">
    <motion.div className="w-44 h-44 rounded-[2.5rem] bg-white border border-slate-100 flex items-center justify-center shadow-2xl shadow-slate-200/60 p-0 overflow-hidden" animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
      <img src="/complete_logo.png" alt="Curalink Logo" className="w-full h-full object-contain" />
    </motion.div>
    <div>
      <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">{disease ? `Researching ${disease}` : 'Welcome to Curalink'}</h2>
      <p className="max-w-sm mx-auto text-base text-slate-400 leading-relaxed">{disease ? "Ask any question and I'll search the latest medical research for you." : 'Set your condition first, then ask me anything about the latest research.'}</p>
    </div>
    {disease && (
      <div className="flex flex-wrap gap-2 justify-center">
        {[`Latest ${disease} treatments`, `${disease} clinical trials`, `${disease} developments 2024`].map((suggestion, i) => (
          <motion.button key={i} onClick={() => onSuggestion(suggestion)} whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }} transition={spring} className="text-sm font-semibold px-4 py-2 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors">
            {suggestion}
          </motion.button>
        ))}
      </div>
    )}
  </motion.div>
));

/* ─── Main App ─── */
export default function App() {
  const dispatch = useDispatch();
  const { 
    messages, chats, activeChatId, disease, location, 
    loading, isStreaming, activeStreamIds, processingChatIds, progress, showModal, sidebarOpen 
  } = useSelector(state => state.chat);
  const { user, isAuthenticated, loading: authLoading } = useSelector(state => state.auth);
  const isChatBusy = isStreaming || processingChatIds.includes(activeChatId) || (loading && !activeChatId);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [analyzedData, setAnalyzedData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const chatEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    chatEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isStationary = scrollHeight - scrollTop - clientHeight < 150; // Threshold to detect if user is near bottom
    
    if (isStationary || messages.length <= 1) {
      scrollToBottom(messages.length <= 2 ? 'auto' : 'smooth');
    }
  }, [messages.length, messages[messages.length-1]?.content, isChatBusy, progress.length]);

  useEffect(() => {
    socket.on('chat:chunk', ({ chatId, chunk }) => {
      dispatch(appendStreamChunk({ chatId, chunk }));
    });
    socket.on('chat:done', (data) => {
      dispatch(completeStreaming(data));
      // Refresh chats list to get the finalized title/message from DB
      dispatch(fetchChats());
    });
    socket.on('progress', (data) => {
      dispatch(addProgress(data));
    });
    return () => {
      socket.off('chat:chunk');
      socket.off('chat:done');
      socket.off('progress');
    };
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchProfile());
    dispatch(fetchContext());
    dispatch(fetchChats());
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(claimChats()).then(() => {
        dispatch(fetchChats());
      });
    }
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 300);
    };
    const sc = scrollContainerRef.current;
    sc.addEventListener('scroll', handleScroll);
    return () => sc.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSend = async (e, textOverride) => {
    if (e) e.preventDefault();
    const messageText = textOverride || input;
    if (!messageText.trim() || loading || isStreaming) return; // Prevent double-send
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

    await dispatch(sendMessage({
      chatId: activeChatId,
      message: messageText,
      context: { disease, location, intent: 'Patient Inquiry' },
      patientData: analyzedData
    }));

    if (!activeChatId) {
      dispatch(fetchChats());
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please upload a report under 5MB.");
      return;
    }

    setIsUploading(true);
    setSelectedFile(file);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/docs/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        withCredentials: true
      });

      if (response.data.success) {
        setAnalyzedData(response.data.data);
      }
    } catch (error) {
      console.error('File Analysis Error:', error);
      alert('Failed to analyze medical report. Please try again.');
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStop = () => {
    if (!activeChatId || (!loading && !isStreaming)) return;
    socket.emit('chat:stop', { chatId: activeChatId });
    dispatch(completeStreaming());
  };

  return (
    <div className="flex h-screen bg-white text-slate-800 font-sans overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0, x: -20 }}
            animate={{ width: typeof window !== 'undefined' && window.innerWidth < 1280 ? 288 : 320, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: -20 }}
            transition={softSpring}
            className="border-r border-slate-100 flex flex-col bg-slate-50/60 flex-shrink-0 z-10 overflow-hidden"
          >
            <div className="p-7 pb-5 min-w-[288px]">
              <div className="flex items-center gap-4 mb-8">
                <motion.div whileHover={{ scale: 1.05 }} transition={spring} className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-md border border-slate-100 p-0 overflow-hidden">
                  <img src="/logoset/android-chrome-192x192.png" alt="Logo" className="w-full h-full object-contain" />
                </motion.div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tighter text-slate-900 leading-tight">Curalink</h1>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Health Companion</span>
                </div>
              </div>
              <AnimatedButton onClick={() => dispatch(resetResearch())} className="w-full cursor-pointer py-3 px-4 rounded-xl bg-blue-600 text-white flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors font-semibold text-sm shadow-md shadow-blue-100">
                <Plus size={17} /> New Research
              </AnimatedButton>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-1 min-w-[288px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-2 mb-3 flex items-center gap-2">
                <History size={11} /> Recent History
              </p>
              {chats.map((chat, i) => (
                <ChatItem 
                  key={chat.id} 
                  chat={chat} 
                  active={activeChatId === chat.id} 
                  streaming={activeStreamIds.includes(chat.id)}
                  onClick={() => dispatch(loadChat(chat.id))} 
                />
              ))}
            </div>

            <div className="p-5 border-t border-slate-100 min-w-[288px]">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white border border-blue-200 flex items-center justify-center flex-shrink-0">
                      <User size={13} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-blue-900 uppercase">Researcher</p>
                      <p className="text-xs font-bold text-blue-600 truncate">{user?.name || user?.email}</p>
                    </div>
                    {isStreaming && <PulseDot />}
                  </div>
                  <button onClick={() => dispatch(logout())} className="w-full py-2.5 cursor-pointer text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest border border-dashed border-slate-200 rounded-xl">
                    Logout Session
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsAuthModalOpen(true)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                  <Lock size={15} /> Sign In to Save
                </button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 border-b border-slate-100 flex items-center justify-between px-6 sm:px-8 bg-white flex-shrink-0 z-20 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <AnimatedButton onClick={() => dispatch(toggleSidebar())} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
              <div className="space-y-1 w-5">
                <motion.div animate={{ rotate: sidebarOpen ? 0 : 45, y: sidebarOpen ? 0 : 7 }} transition={spring} className="h-0.5 bg-current rounded-full" />
                <motion.div animate={{ opacity: sidebarOpen ? 1 : 0 }} transition={{ duration: 0.15 }} className="h-0.5 bg-current rounded-full" />
                <motion.div animate={{ rotate: sidebarOpen ? 0 : -45, y: sidebarOpen ? 0 : -7 }} transition={spring} className="h-0.5 bg-current rounded-full" />
              </div>
            </AnimatedButton>
            <AnimatePresence mode="wait">
              {disease ? (
                <motion.div key="context" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={softSpring} className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className="text-sm font-medium text-slate-400 whitespace-nowrap">Researching:</span>
                  <span className="text-sm font-bold text-blue-600 px-3 py-1 bg-blue-50 rounded-full border border-blue-100">{disease}</span>
                  {location && <span className="text-sm text-slate-400 flex items-center gap-1 whitespace-nowrap"><MapPin size={13} /> {location}</span>}
                  <button onClick={() => dispatch(setShowModal(true))} className="text-[10px] cursor-pointer font-bold text-slate-300 hover:text-blue-500 transition-colors uppercase tracking-widest ml-1">Change</button>
                </motion.div>
              ) : (
                <p key="empty" className="text-sm text-slate-300 italic">No condition selected</p>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap flex-shrink-0">
            <ShieldCheck size={13} className="text-blue-500" />
            <span className="hidden sm:inline">Research Mode</span>
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/30 scroll-smooth relative">
          <AnimatePresence>
            {loading && !messages.length && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-50/60 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col items-center gap-6">
                  <div className="relative">
                    <motion.div 
                      animate={{ rotate: 360 }} 
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      className="w-14 h-14 border-4 border-blue-100 border-t-blue-500 rounded-full"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PulseDot />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Curalink System</p>
                    <p className="text-sm font-bold text-slate-400">Retrieving Research History</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="max-w-4xl mx-auto px-4 sm:px-10 py-10 pb-32">
            {!activeChatId && messages.length === 0 ? (
              <EmptyState disease={disease} onSuggestion={(s) => handleSend(null, s)} />
            ) : (
              <div className="space-y-12">
                {messages.map((msg) => <MessageItem key={msg.id} msg={msg} />)}
                
                {/* Active Reasoning/Processing State */}
                {(isChatBusy && !isStreaming) && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4">
                    <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Heart size={15} className="text-blue-500 fill-blue-100" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-5 py-3 shadow-sm flex items-center gap-3">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Synthesizing clinical data...</span>
                      <TypingDots />
                    </div>
                  </motion.div>
                )}

                {isStreaming && (
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 flex items-center justify-center flex-shrink-0">
                      <Heart size={15} className="text-blue-500 fill-blue-100" />
                    </div>
                    <TypingDots />
                  </div>
                )}
                {loading && !isStreaming && progress.length > 0 && (
                  <div className="ml-10 space-y-2">
                    {progress.map((p, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
                        <Loader2 className="animate-spin text-blue-500" size={12} />
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{p.message}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showScrollButton && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.8 }} className="absolute bottom-28 right-6 sm:right-12 z-40">
              <button onClick={() => scrollToBottom()} className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-xl grid place-items-center p-0 text-blue-600 hover:text-blue-700 hover:border-blue-200 transition-all hover:scale-110 active:scale-95 bg-white/80 backdrop-blur-md">
                <ChevronDown size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-10 pb-6 pt-10 bg-gradient-to-t from-white via-white/95 to-transparent">
          {/* Atomic Concurrency Lock logic */}
          {(() => {
            return (
              <form onSubmit={handleSend} className="w-full lg:max-w-[70%] max-w-[95%] mx-auto flex items-end gap-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-lg shadow-slate-100/80 focus-within:border-blue-300">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf, .jpg, .jpeg, .png"
                />
                
                <AnimatedButton 
                  type="button" 
                  onClick={() => {
                    if (!isAuthenticated) {
                      setIsAuthModalOpen(true);
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  disabled={isChatBusy || isUploading}
                  className={`mb-1 p-2.5 rounded-xl transition-all flex-shrink-0 ${
                    !isAuthenticated 
                      ? 'bg-slate-50 text-slate-300 border border-slate-100' 
                      : 'hover:bg-slate-100 text-slate-400'
                  }`}
                >
                  {isUploading ? (
                    <Loader2 size={20} className="animate-spin text-blue-500" />
                  ) : !isAuthenticated ? (
                    <Lock size={18} className="text-slate-300" />
                  ) : (
                    <Paperclip size={20} />
                  )}
                </AnimatedButton>

                <div className="flex-1 relative flex flex-col">
                  {selectedFile && (
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute bottom-full mb-3 left-0">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg shadow-sm">
                        <FileText size={14} className="text-blue-500" />
                        <span className="text-[11px] font-bold text-blue-700 truncate max-w-[120px]">{selectedFile.name}</span>
                        {analyzedData && <Sparkles size={12} className="text-teal-500" title="Analyzed" />}
                        <button 
                          onClick={() => { setSelectedFile(null); setAnalyzedData(null); }}
                          className="ml-1 p-0.5 rounded-full hover:bg-blue-100 text-blue-400"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    disabled={isChatBusy}
                    onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                    placeholder={isChatBusy ? "Synthesizing research..." : (disease ? `Ask about ${disease}…` : 'Set a condition first…')}
                    className="w-full bg-transparent border-none focus:ring-0 text-[15px] font-medium px-3 py-2.5 placeholder:text-slate-300 text-slate-800 min-w-0 resize-none max-h-[120px] outline-none disabled:opacity-50"
                  />
                </div>
                {isChatBusy ? (
                  <AnimatedButton type="button" onClick={handleStop} className="mb-1 px-5 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-colors flex items-center gap-2">
                    <Square size={14} fill="white" />
                    <span className="hidden sm:inline">Stop Reasoning</span>
                  </AnimatedButton>
                ) : (
                  <AnimatedButton 
                    type="submit" 
                    disabled={(!input.trim() && !analyzedData) || !disease} 
                    className={`mb-1 px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                      ((!input.trim() && !analyzedData) || !disease)
                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100'
                    }`}
                  >
                    <Sparkles size={15} />
                    <span className="hidden sm:inline">Search Research</span>
                  </AnimatedButton>
                )}
              </form>
            );
          })()}
          <p className="text-[10px] text-center text-slate-300 mt-3 font-bold uppercase tracking-widest">Research-Backed Insights • Empathetic Care</p>
        </div>
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <AnimatePresence>{showModal && <FocusModal dispatch={dispatch} disease={disease} location={location} />}</AnimatePresence>
    </div>
  );
}

const FocusModal = ({ dispatch, disease, location }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 text-slate-800">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => dispatch(setShowModal(false))} />
    <motion.div initial={{ opacity: 0, y: 80, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 80, scale: 0.95 }} className="relative w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden p-8 sm:p-10">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 to-teal-400" />
      <button onClick={() => dispatch(setShowModal(false))} className="absolute top-5 right-5 p-2.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
      
      <div className="mb-8">
        <motion.div whileHover={{ scale: 1.05 }} transition={spring} className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-6 shadow-xl shadow-slate-200/50 p-0 overflow-hidden">
          <img src="/complete_logo.png" alt="Curalink" className="w-full h-full object-contain" />
        </motion.div>
        <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Let's set your focus</h3>
        <p className="text-sm text-slate-400 leading-relaxed">Define your condition to enable high-authority medical synthesis tailored to your needs.</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5">Condition or Disease</label>
          <input value={disease} onChange={e => dispatch(setDisease(e.target.value))} onKeyDown={e => e.key === 'Enter' && disease.trim() && dispatch(setShowModal(false))} placeholder="e.g. Type 2 Diabetes" autoFocus className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-4 text-[15px] font-bold outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-300" />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5">Your Location (optional)</label>
          <div className="relative">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input value={location} onChange={e => dispatch(setLocation(e.target.value))} placeholder="e.g. New York, USA" className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-12 pr-4 py-4 text-[15px] font-bold outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-300" />
          </div>
        </div>

        <AnimatedButton 
          disabled={!disease.trim()} 
          onClick={() => dispatch(setShowModal(false))} 
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 disabled:opacity-30 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3 mt-4"
        >
          <Sparkles size={16} />
          Start Researching
        </AnimatedButton>
      </div>
    </motion.div>
  </div>
);
