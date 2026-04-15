import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { logout } from './authSlice';

const API_BASE = 'http://localhost:5000/api';

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
  isStreaming: false, // NEW: Tracks live synthesis
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
      if (action.payload.chatId === state.activeChatId) {
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
    appendStreamChunk: (state, action) => {
      const { chatId, chunk } = action.payload;
      state.isStreaming = true; // Actively streaming
      
      if (!state.activeChatId && chatId) state.activeChatId = chatId;
      if (chatId === state.activeChatId) {
        const lastMsg = state.messages[state.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content += chunk;
        } else {
          state.messages.push({ 
            id: 'streaming-asst', 
            role: 'assistant', 
            content: chunk 
          });
        }
      }
    },
    completeStreaming: (state) => {
      state.loading = false;
      state.isStreaming = false; // Eagerly unlock UI
      state.progress = [];
      state.streamingChatId = null;
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
        state.progress = [];
      })
      .addCase(loadChat.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadChat.fulfilled, (state, action) => {
        state.loading = false;
        state.activeChatId = action.payload.id;
        state.messages = action.payload.data.messages || [];
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
      .addCase(sendMessage.pending, (state) => {
        state.loading = true;
        state.progress = [];
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.loading = false;
        state.isStreaming = false; // Cleanup if not already done by socket
        state.progress = [];
        const { chatId } = action.payload;
        if (chatId === state.activeChatId) {
          const lastMsg = state.messages[state.messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.sources = action.payload.sources;
          }
        }
        if (!state.activeChatId) state.activeChatId = chatId;
      })
      .addCase(sendMessage.rejected, (state) => {
        state.loading = false;
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
  setDisease, setLocation, setShowModal, setSidebarOpen, toggleSidebar,
  setActiveChat, clearMessages, addProgress, resetResearch,
  addLocalMessage, appendStreamChunk, completeStreaming
} = chatSlice.actions;

export default chatSlice.reducer;
