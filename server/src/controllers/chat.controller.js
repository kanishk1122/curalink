const prisma = require('../config/db');
const researchService = require('../services/research.service');
const aiService = require('../services/ai.service');

// Global registry for active chat stream stop signals
const activeStopSignals = new Map();

/**
 * Handle new chat creation and messages
 */
const sendMessage = async (req, res) => {
  const { chatId, message, context } = req.body;
  
  try {
    let chat;
    if (chatId) {
      chat = await prisma.chat.findUnique({ 
        where: { id: chatId },
        include: { messages: { take: 15, orderBy: { createdAt: 'asc' } } }
      });
    } else {
      chat = await prisma.chat.create({
        data: { 
          title: context.disease || 'New Medical Inquiry',
          userId: req.user?.id || null
        }
      });
    }

    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    
    // Authorization Check
    if (chat.userId && chat.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Clear any previous stop signal for this chat
    activeStopSignals.delete(chat.id);

    // Save User Message
    await prisma.message.create({
      data: { chatId: chat.id, role: 'user', content: message }
    });

    // 1. Expand Query
    req.io.emit('progress', { chatId: chat.id, message: 'Performing semantic feature extraction and agent routing...' });
    let expanded = await aiService.expandQuery(message, context);
    
    // 2. Initial Fetch
    req.io.emit('progress', { 
      chatId: chat.id, 
      message: 'Routing mechanistic inquiry to PubMed/OpenAlex; Clinical mapping to Trials database...',
      details: `Agents: ${expanded.keywords.slice(0, 3).join(', ')} | Region: ${expanded.location || 'Global'}`
    });

    let [pubmed, openalex, trials] = await Promise.all([
      researchService.fetchPubMed(expanded.pubmed_query, expanded.location),
      researchService.fetchOpenAlex(expanded.keywords.join(' '), expanded.location),
      researchService.fetchClinicalTrials(expanded.clinical_trials_condition, expanded.location)
    ]);

    let allResults = [...pubmed, ...openalex, ...trials];

    // 3. Search Resilience: Fallback if results are empty
    if (allResults.length === 0) {
      req.io.emit('progress', { chatId: chat.id, message: 'Precision search returned no direct papers. Retrying with high-recall keywords...' });
      
      const fallbackKeywords = expanded.keywords.slice(0, 3).join(' '); // Simple keywords
      [pubmed, openalex] = await Promise.all([
        researchService.fetchPubMed(fallbackKeywords, ''), // Broaden to global if local fails
        researchService.fetchOpenAlex(fallbackKeywords, '')
      ]);
      allResults = [...pubmed, ...openalex, ...trials];
    }

    req.io.emit('progress', { chatId: chat.id, message: `Acquired ${allResults.length} data points. Synthesizing insights...` });

    const topResults = researchService.rankResults(allResults, expanded.location, 8);
    
    // 4. Stream AI Reasoning with Abort Handling
    const history = chat.messages || [];
    let fullResponse = '';
    let stopped = false;
    
    const steamGenerator = aiService.reasonOverResearchStream(message, topResults, history, expanded.location);
    
    // Listen for client-side stop signal via a specific socket ID if available, or simpler global map
    // For this implementation, we use a simple shared map that the socket handler can toggle.
    try {
      for await (const chunk of steamGenerator) {
        // CHECK STOP SIGNAL
        if (activeStopSignals.has(chat.id)) {
          stopped = true;
          req.io.emit('progress', { chatId: chat.id, message: 'Research synthesis paused by user.' });
          break;
        }

        fullResponse += chunk;
        req.io.emit('chat:chunk', { chatId: chat.id, chunk });
      }
    } catch (streamError) {
      console.error('Stream processing error:', streamError);
    } finally {
      // CLEAR UI STATE REGARDLESS OF SUCCESS/TRUNCATION
      req.io.emit('chat:done', { chatId: chat.id });
    }

    // 5. Data Integrity: Save Message even if stopped/interrupted
    if (fullResponse.trim().length > 0) {
      const savedMessage = await prisma.message.create({
        data: {
          chatId: chat.id,
          role: 'assistant',
          content: fullResponse + (stopped ? ' [Paused by User]' : ''),
          sources: {
            create: topResults.map(r => ({
              title: r.title,
              url: r.url,
              authors: r.authors,
              year: r.year,
              platform: r.platform,
              snippet: r.snippet,
              type: r.type,
              status: r.status,
              location: r.location
            }))
          }
        },
        include: { sources: true }
      });

      // Cleanup
      activeStopSignals.delete(chat.id);

      return res.json({
        chatId: chat.id,
        response: fullResponse,
        sources: savedMessage.sources,
        stopped
      });
    }

    res.json({ chatId: chat.id, response: 'Inquiry paused.' });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
};

/**
 * Global Socket Handler Integration
 * Call this from index.js to enable the stop signal
 */
const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    socket.on('chat:stop', ({ chatId }) => {
      console.log(`[Socket] Received stop signal for Chat: ${chatId}`);
      activeStopSignals.set(chatId, true);
    });
  });
};

const getChatHistory = async (req, res) => {
  const { id } = req.params;
  try {
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: { 
        messages: { 
          include: { sources: true },
          orderBy: { createdAt: 'asc' }
        } 
      }
    });

    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

const listChats = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const chats = await prisma.chat.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
};

/**
 * Fetch the most recent context (Disease/Location) for the user
 */
const getRecentContext = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const recentChat = await prisma.chat.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          where: { role: 'assistant' },
          include: { sources: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!recentChat) {
      return res.json({ disease: '', location: '' });
    }

    const lastLoc = recentChat.messages[0]?.sources.find(s => s.location)?.location || '';

    res.json({
      disease: recentChat.title || '',
      location: lastLoc
    });
  } catch (error) {
    console.error('GetContext Error:', error);
    res.json({ disease: '', location: '' });
  }
};

module.exports = {
  sendMessage,
  getChatHistory,
  listChats,
  getRecentContext,
  setupSocketHandlers
};
