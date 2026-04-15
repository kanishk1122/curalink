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
  const response = await api.get(`/chat/${id}?limit=20`);
  return { id, data: response.data };
});

export const fetchMoreHistory = createAsyncThunk(
  'chat/fetchMoreHistory',
  async ({ chatId, cursorId }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/chat/${chatId}?cursor=${cursorId}&limit=20`);
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

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
  country: '',
  countryCode: '',
  state: '',
  stateCode: '',
  loading: false,
  isStreaming: false, 
  streamingBuffers: {}, 
  activeStreamIds: [], 
  processingChatIds: [], // NEW: Tracks in-flight HTTP requests per chat
  progress: [],
  showModal: false,
  sidebarOpen: true,
  streamingChatId: null,
  error: null,
  hasMoreHistory: true, // Tracks if there are older messages in DB
  isFetchingMore: false
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
    setFocus: (state, action) => {
      const { disease, location, country, countryCode, state: sName, stateCode } = action.payload;
      state.disease = disease ?? state.disease;
      state.location = location ?? state.location;
      state.country = country ?? state.country;
      state.countryCode = countryCode ?? state.countryCode;
      state.state = sName ?? state.state;
      state.stateCode = stateCode ?? state.stateCode;
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
        state.hasMoreHistory = true; // Reset on new chat load
        state.messages = []; // ATOMIC CLEAR: Fix flickering of old chat
        state.progress = []; 
        const targetChatId = action.meta.arg;
        state.activeChatId = targetChatId;
        state.isStreaming = !!state.streamingBuffers[targetChatId] || state.activeStreamIds.includes(targetChatId);
      })
      .addCase(loadChat.fulfilled, (state, action) => {
        state.loading = false;
        const chatId = action.payload.id;
        state.activeChatId = chatId;
        
        let messages = action.payload.data.messages || [];
        
        // Pagination check
        if (messages.length < 20) {
          state.hasMoreHistory = false;
        }

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
        state.progress = [];

        // ATOMIC RE-HYDRATION: Restore focused research context from Chat Metadata
        const metadata = action.payload.data.metadata;
        if (metadata) {
          state.disease = metadata.disease || '';
          state.location = metadata.location || '';
          state.country = metadata.country || '';
          state.countryCode = metadata.countryCode || '';
          state.state = metadata.state || '';
          state.stateCode = metadata.stateCode || '';
        } else {
          // Fallback to title if metadata is missing (legacy chats)
          state.disease = action.payload.data.title || '';
        }
      })
      .addCase(fetchMoreHistory.pending, (state) => {
        state.isFetchingMore = true;
      })
      .addCase(fetchMoreHistory.fulfilled, (state, action) => {
        state.isFetchingMore = false;
        const newMessages = action.payload.messages || [];
        if (newMessages.length < 20) {
          state.hasMoreHistory = false;
        }
        // Prepend new messages to the beginning of the list
        state.messages = [...newMessages, ...state.messages];
      })
      .addCase(fetchMoreHistory.rejected, (state) => {
        state.isFetchingMore = false;
        state.hasMoreHistory = false;
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
  setShowModal, setDisease, setLocation, setFocus, toggleSidebar, addLocalMessage, setActiveChat, clearMessages
} = chatSlice.actions;

export default chatSlice.reducer;
