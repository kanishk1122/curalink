const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const helmet = require('helmet');
const { globalLimiter } = require('./middlewares/rate-limit.middleware');

dotenv.config();

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://whale-app-a4lge.ondigitalocean.app'
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

const app = express();
console.log(`◇ Curalink System: ${Object.keys(process.env).filter(k => !['PATH', 'HOME', 'USER', 'PWD'].includes(k)).length} environment keys successfully active.`);

// CLOUD PROXY TRUST (Required for DigitalOcean/Rate Limiting)
app.set('trust proxy', 1);

// SECURITY HEADERS
app.use(helmet());

// GLOBAL RATE LIMIT
app.use('/api', globalLimiter);
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// MIDDLEWARES
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// SESSION ISOLATION (Assigned to all visitors)
const sessionMiddleware = require('./middlewares/session.middleware');
app.use(sessionMiddleware);

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
