import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { logout } from './authSlice';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true
});

// Async Thunks
export const fetchChats = createAsyncThunk('chat/fetchChats', async () => {
  const response = await api.get(`/chat`);
  return response.data;
});

export const fetchContext = createAsyncThunk('chat/fetchContext', async () => {
  const response = await api.get(`/chat/context`);
  return response.data;
});

export const loadChat = createAsyncThunk('chat/loadChat', async (id) => {
  const response = await api.get(`/chat/${id}`);
  return { id, data: response.data };
});

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ chatId, message, context }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/chat/message`, {
        chatId,
        message,
        context
      });
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

// Claim Chats now purely relies on the backend session cookie
export const claimChats = createAsyncThunk(
  'chat/claimChats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.post(`/auth/claim`);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

const initialState = {
  messages: [],
  chats: [],
  activeChatId: null,
  disease: '',
  location: '',
  loading: false,
  isStreaming: false, 
  streamingBuffers: {}, 
  activeStreamIds: [], 
  processingChatIds: [], // NEW: Tracks in-flight HTTP requests per chat
  progress: [],
  showModal: false,
  sidebarOpen: true,
  streamingChatId: null,
  error: null
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setDisease: (state, action) => {
      state.disease = action.payload;
    },
    setLocation: (state, action) => {
      state.location = action.payload;
    },
    setShowModal: (state, action) => {
      state.showModal = action.payload;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setActiveChat: (state, action) => {
      state.activeChatId = action.payload;
    },
    clearMessages: (state) => {
      state.messages = [];
    },
    addProgress: (state, action) => {
      // Allow progress if it matches active chat OR if we are in a 'New Research' state (null activeChatId)
      if (action.payload.chatId === state.activeChatId || !state.activeChatId) {
        state.progress = [...state.progress.slice(-2), action.payload];
      }
    },
    resetResearch: (state) => {
      state.activeChatId = null;
      state.messages = [];
      state.disease = '';
      state.location = '';
      state.showModal = true;
    },
    addLocalMessage: (state, action) => {
      state.messages.push({ ...action.payload, id: Date.now().toString() });
    },
    appendStreamBatch: (state, action) => {
      const batches = action.payload; // { [chatId]: chunk }
      
      Object.entries(batches).forEach(([chatId, chunk]) => {
        if (!state.streamingBuffers[chatId]) {
          state.streamingBuffers[chatId] = "";
          if (!state.activeStreamIds.includes(chatId)) {
            state.activeStreamIds.push(chatId);
          }
        }
        state.streamingBuffers[chatId] += chunk;
        
        // Adoption logic for new chats
        if (!state.activeChatId && state.loading) {
          state.activeChatId = chatId;
        }

        if (chatId === state.activeChatId) {
          state.isStreaming = true;
          const lastMsg = state.messages[state.messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === 'streaming-asst-' + chatId) {
            lastMsg.content += chunk;
          } else {
            state.messages.push({ 
              id: 'streaming-asst-' + chatId, 
              role: 'assistant', 
              content: chunk 
            });
          }
        }
      });
    },
    appendStreamChunk: (state, action) => {
      const { chatId, chunk } = action.payload;
      
      if (!state.streamingBuffers[chatId]) {
        state.streamingBuffers[chatId] = "";
        if (!state.activeStreamIds.includes(chatId)) {
          state.activeStreamIds.push(chatId);
        }
      }
      state.streamingBuffers[chatId] += chunk;
      
      if (!state.activeChatId && state.loading) {
        state.activeChatId = chatId;
      }

      if (chatId === state.activeChatId) {
        state.isStreaming = true;
        const lastMsg = state.messages[state.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === 'streaming-asst-' + chatId) {
          lastMsg.content += chunk;
        } else {
          state.messages.push({ 
            id: 'streaming-asst-' + chatId, 
            role: 'assistant', 
            content: chunk 
          });
        }
      }
    },
    completeStreaming: (state, action) => {
      const chatId = action.payload?.chatId;
      
      if (chatId) {
        delete state.streamingBuffers[chatId];
        state.activeStreamIds = state.activeStreamIds.filter(id => id !== chatId);
        state.processingChatIds = state.processingChatIds.filter(id => id !== chatId); // Final safety cleanup
        
        if (chatId === state.activeChatId) {
          state.isStreaming = false;
          state.loading = false;
          state.progress = [];
          state.streamingChatId = null;
        }
      } else {
        state.isStreaming = false;
        state.loading = false;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase('auth/logout/fulfilled', (state) => {
        state.messages = [];
        state.chats = [];
        state.activeChatId = null;
        state.disease = '';
        state.location = '';
        state.loading = false;
        state.isStreaming = false;
        state.streamingBuffers = {};
        state.activeStreamIds = [];
        state.processingChatIds = [];
        state.progress = [];
      })
      .addCase(loadChat.pending, (state, action) => {
        state.loading = true;
        const targetChatId = action.meta.arg;
        state.activeChatId = targetChatId;
        state.isStreaming = !!state.streamingBuffers[targetChatId] || state.activeStreamIds.includes(targetChatId);
      })
      .addCase(loadChat.fulfilled, (state, action) => {
        state.loading = false;
        const chatId = action.payload.id;
        state.activeChatId = chatId;
        
        let messages = action.payload.data.messages || [];
        
        if (state.streamingBuffers[chatId]) {
          messages.push({
            id: 'streaming-asst-' + chatId,
            role: 'assistant',
            content: state.streamingBuffers[chatId]
          });
          state.isStreaming = true;
        } else {
          state.isStreaming = false;
        }

        state.messages = messages;
        state.disease = action.payload.data.title || '';
        
        const lastAsstMsg = [...state.messages].reverse().find(m => m.role === 'assistant');
        if (lastAsstMsg && lastAsstMsg.sources) {
           const locSource = lastAsstMsg.sources.find(s => s.location);
           if (locSource) state.location = locSource.location;
        }
      })
      .addCase(fetchChats.fulfilled, (state, action) => {
        state.chats = action.payload;
      })
      .addCase(fetchContext.fulfilled, (state, action) => {
        state.disease = action.payload.disease;
        state.location = action.payload.location;
      })
      .addCase(sendMessage.pending, (state, action) => {
        state.loading = true;
        const currentChatId = action.meta.arg.chatId;
        if (currentChatId && !state.processingChatIds.includes(currentChatId)) {
          state.processingChatIds.push(currentChatId);
        }
        state.progress = [];
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.loading = false;
        const { chatId } = action.payload;
        state.processingChatIds = state.processingChatIds.filter(id => id !== chatId);
        
        state.progress = [];
        if (chatId === state.activeChatId) {
          const lastMsg = state.messages[state.messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.sources = action.payload.sources;
          }
        }
        if (!state.activeChatId) state.activeChatId = chatId;
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.loading = false;
        const currentChatId = action.meta.arg.chatId;
        state.processingChatIds = state.processingChatIds.filter(id => id !== currentChatId);
        state.isStreaming = false;
        state.progress = [];
        state.messages.push({
          id: 'error-' + Date.now(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error during synthesis."
        });
      });
  }
});

export const { 
  resetResearch, addProgress, appendStreamChunk, appendStreamBatch, completeStreaming, 
  setShowModal, setDisease, setLocation, toggleSidebar, addLocalMessage, setActiveChat, clearMessages
} = chatSlice.actions;

export default chatSlice.reducer;
