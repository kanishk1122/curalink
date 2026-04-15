import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

// Config for authorized requests
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Async Thunks
export const fetchChats = createAsyncThunk('chat/fetchChats', async () => {
  const response = await axios.get(`${API_BASE}/chat`, { headers: getAuthHeader() });
  return response.data;
});

export const fetchContext = createAsyncThunk('chat/fetchContext', async () => {
  const response = await axios.get(`${API_BASE}/chat/context`, { headers: getAuthHeader() });
  return response.data;
});

export const loadChat = createAsyncThunk('chat/loadChat', async (id) => {
  const response = await axios.get(`${API_BASE}/chat/${id}`, { headers: getAuthHeader() });
  return { id, data: response.data };
});

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ chatId, message, context }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE}/chat/message`, {
        chatId,
        message,
        context
      }, { headers: getAuthHeader() });
      return response.data;
    } catch (err) {
      return rejectWithValue(err.response.data);
    }
  }
);

export const claimChats = createAsyncThunk(
  'chat/claimChats',
  async (chatIds, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/claim`, { chatIds }, { headers: getAuthHeader() });
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
  progress: [],
  showModal: false,
  sidebarOpen: true,
  streamingChatId: null,
  guestChatIds: JSON.parse(sessionStorage.getItem('guestChatIds') || '[]'),
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
      // For new chats, adopt the ID as soon as research starts
      if (!state.activeChatId && action.payload.chatId) {
        state.activeChatId = action.payload.chatId;
      }
      // Only show progress if it matches the current active chat
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
      state.messages.push(action.payload);
    },
    appendStreamChunk: (state, action) => {
      const { chatId, chunk } = action.payload;
      
      // For new chats, ensure we are tracking the ID
      if (!state.activeChatId && chatId) {
        state.activeChatId = chatId;
      }

      if (chatId === state.activeChatId) {
        const lastMsg = state.messages[state.messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content += chunk;
        } else {
          state.messages.push({ role: 'assistant', content: chunk });
        }
      }
    },
    completeStreaming: (state) => {
      state.loading = false;
      state.progress = [];
      state.streamingChatId = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Chats
      .addCase(fetchChats.fulfilled, (state, action) => {
        state.chats = action.payload;
      })
      // Fetch Context
      .addCase(fetchContext.fulfilled, (state, action) => {
        if (action.payload.disease) {
          state.disease = action.payload.disease;
          state.location = action.payload.location;
          state.showModal = false;
        } else {
          state.showModal = true;
        }
      })
      .addCase(fetchContext.rejected, (state) => {
        state.showModal = true;
      })
      // Load Chat
      .addCase(loadChat.pending, (state) => {
        state.loading = true;
        state.messages = [];
        state.progress = []; // Reset progress for the new chat
      })
      .addCase(loadChat.fulfilled, (state, action) => {
        state.loading = false;
        state.activeChatId = action.payload.id;
        state.messages = action.payload.data.messages || [];
        if (action.payload.data.title && action.payload.data.title !== 'New Medical Inquiry') {
          state.disease = action.payload.data.title;
        }
      })
      // Send Message
      .addCase(sendMessage.pending, (state) => {
        state.loading = true;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.loading = false;
        state.progress = [];
        state.streamingChatId = null;

        const { chatId } = action.payload;
        
        // Track as guest chat if not logged in
        const token = localStorage.getItem('token');
        if (!token && !state.guestChatIds.includes(chatId)) {
          state.guestChatIds.push(chatId);
          sessionStorage.setItem('guestChatIds', JSON.stringify(state.guestChatIds));
        }
        
        // Finalize the message with sources if we are in the correct chat
        if (chatId === state.activeChatId) {
          const lastMsg = state.messages[state.messages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.sources = action.payload.sources;
          }
        }
        
        if (!state.activeChatId) {
          state.activeChatId = chatId;
        }
      })
      // Claim Chats
      .addCase(claimChats.fulfilled, (state) => {
        state.guestChatIds = [];
        sessionStorage.removeItem('guestChatIds');
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.loading = false;
        state.progress = [];
        state.messages.push({
          role: 'assistant',
          content: "I'm sorry, I'm having trouble connecting to my research databases right now."
        });
      });
  }
});

export const { 
  setDisease, 
  setLocation, 
  setShowModal, 
  setSidebarOpen,
  toggleSidebar,
  setActiveChat, 
  clearMessages, 
  addProgress, 
  resetResearch,
  addLocalMessage,
  appendStreamChunk,
  completeStreaming
} = chatSlice.actions;

export default chatSlice.reducer;
