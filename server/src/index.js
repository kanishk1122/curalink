const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Pass io to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

const chatRoutes = require('./routes/chat.routes');
const authRoutes = require('./routes/auth.routes');
const { setupSocketHandlers } = require('./controllers/chat.controller');

// Initialize socket handlers
setupSocketHandlers(io);

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

server.listen(PORT, () => {
  console.log(`Curalink Backend running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});
