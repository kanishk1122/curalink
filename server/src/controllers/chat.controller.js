const prisma = require('../config/db');
const redis = require('../config/redis');
const researchService = require('../services/research.service');
const aiService = require('../services/ai.service');

// Global registry for active chat stream stop signals
const activeStopSignals = new Map();

/**
 * Handle new chat creation and messages
 */
const sendMessage = async (req, res) => {
  const { chatId, message, context, patientData } = req.body;
  const userId = req.user?.id || null;
  const sessionId = req.sessionId; // From sessionMiddleware
  
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
          userId,
          sessionId,
          metadata: context ? {
            disease: context.disease,
            location: context.location,
            country: context.country,
            countryCode: context.countryCode,
            state: context.state,
            stateCode: context.stateCode
          } : null
        }
      });
    }

    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    
    // STRICT TENANT ISOLATION CHECK
    // 1. If chat is owned by a user, only that user can access.
    // 2. If chat is a guest chat (userId is null), only the creator session can access.
    const isOwner = chat.userId ? (chat.userId === userId) : (chat.sessionId === sessionId);
    
    if (!isOwner) {
      return res.status(403).json({ error: 'You do not have permission to access this research session.' });
    }
    
    // Clear any previous stop signal for this chat
    activeStopSignals.delete(chat.id);

    // INHERITANCE LOGIC: If incoming patientData is null, search history for existing context
    let contextToUse = patientData;
    if (!contextToUse && chat.messages && chat.messages.length > 0) {
      const msgWithContext = [...chat.messages].reverse().find(m => m.metadata && m.metadata.patientContext);
      if (msgWithContext) {
        contextToUse = msgWithContext.metadata.patientContext;
      }
    }

    // Save User Message with persistence of Lab Report Context
    await prisma.message.create({
      data: { 
        chatId: chat.id, 
        role: 'user', 
        content: message,
        metadata: patientData ? { 
          patientContext: patientData,
          promptInstruction: '## 📋 Executive Summary\n[Brief medical overview. You MUST start by explicitly mentioning any uploaded patient lab results used to anchor this research (e.g. "Analyzing based on your elevated CRP markers...")]'
        } : null
      }
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
      const fallbackKeywords = expanded.keywords.slice(0, 3).join(' ');
      [pubmed, openalex] = await Promise.all([
        researchService.fetchPubMed(fallbackKeywords, ''),
        researchService.fetchOpenAlex(fallbackKeywords, '')
      ]);
      allResults = [...pubmed, ...openalex, ...trials];
    }

    req.io.emit('progress', { chatId: chat.id, message: `Acquired ${allResults.length} data points. Synthesizing insights...` });

    const topResults = researchService.rankResults(allResults, expanded.location, 8);
    
    // 4. Stream AI Reasoning
    const history = chat.messages || [];
    let fullResponse = '';
    let stopped = false;
    
    const steamGenerator = aiService.reasonOverResearchStream(message, topResults, history, expanded.location, contextToUse);
    
    try {
      for await (const chunk of steamGenerator) {
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
      req.io.emit('chat:done', { chatId: chat.id });
    }

    // 5. Data Integrity: Save Message
    if (fullResponse.trim().length > 0) {
      const savedMessage = await prisma.message.create({
        data: {
          chatId: chat.id,
          role: 'assistant',
          content: fullResponse + (stopped ? ' [Paused by User]' : ''),
          sources: {
            create: topResults.map(r => ({
              title: r.title, url: r.url, authors: r.authors, year: r.year,
              platform: r.platform, snippet: r.snippet, type: r.type,
              status: r.status, location: r.location
            }))
          }
        },
        include: { sources: true }
      });

      activeStopSignals.delete(chat.id);

      // CACHE INVALIDATION: Purge sidebar chats cache for this user/session
      const cacheKey = `chats:${userId || sessionId}`;
      await redis.del(cacheKey);

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
  const start = Date.now();
  const { id } = req.params;
  const { cursor, limit = 20 } = req.query;
  const userId = req.user?.id || null;
  const sessionId = req.sessionId;

  try {
    const cacheKey = `history:${id}:${cursor || 'start'}`;
    if (!cursor) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[Perf] getChatHistory (Cache Hit): ${Date.now() - start}ms`);
        return res.json(cached);
      }
    }

    // High-performance targeted fetch using the new chatId index
    const chatPromise = prisma.chat.findUnique({
      where: { id },
      include: { 
        messages: { 
          include: { sources: true },
          take: parseInt(limit),
          ...(cursor && { 
            skip: 1,
            cursor: { id: cursor } 
          }),
          orderBy: { createdAt: 'desc' }
        } 
      }
    });

    const [chat] = await Promise.all([chatPromise]);

    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const isOwner = chat.userId ? (chat.userId === userId) : (chat.sessionId === sessionId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    chat.messages.reverse();

    if (!cursor) {
      await redis.set(cacheKey, chat, { ex: 300 });
    }

    console.log(`[Perf] getChatHistory (DB Fetch): ${Date.now() - start}ms`);
    res.json(chat);
  } catch (error) {
    console.error('GetHistory Error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

const listChats = async (req, res) => {
  const start = Date.now();
  try {
    const userId = req.user?.id || null;
    const sessionId = req.sessionId;
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const cacheKey = `chats:${userId || sessionId}`;
    if (parseInt(page) === 1) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[Perf] listChats (Cache Hit): ${Date.now() - start}ms`);
        return res.json(cached);
      }
    }

    const chats = await prisma.chat.findMany({
      where: userId ? { userId } : { userId: null, sessionId },
      orderBy: { updatedAt: 'desc' },
      take: parseInt(limit),
      skip
    });

    if (parseInt(page) === 1) {
      await redis.set(cacheKey, chats, { ex: 300 });
    }

    console.log(`[Perf] listChats (DB Fetch): ${Date.now() - start}ms`);
    res.json(chats);
  } catch (error) {
    console.error('ListChats Error:', error);
    res.status(500).json({ error: 'Failed to list research' });
  }
};

/**
 * Fetch the most recent context (Disease/Location) for the user session
 */
const getRecentContext = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const sessionId = req.sessionId;

    const recentChat = await prisma.chat.findFirst({
      where: userId ? { userId } : { userId: null, sessionId },
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
