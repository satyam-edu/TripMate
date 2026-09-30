import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';

import userRoutes from './routes/user.routes';
import tripRoutes from './routes/trip.routes';
import requestRoutes from './routes/request.routes';
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import { initSocket } from './socket';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });
// Chat needs a looser cap than other writes: people send many short messages.
const chatLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60 });

// ── Core Middlewares ─────────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '100kb' }));

// ── Rate Limiting (per IP) ───────────────────────────────────────────────────
// Render sits behind a proxy; trust it so req.ip is the real client IP.
app.set('trust proxy', 1);
const isChatSend = (req: Request) => req.method === 'POST' && req.path.startsWith('/chats/');
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, skip: isChatSend }));
// Stricter cap on writes (create trip / send request / login / profile edits).
app.use('/api', (req, res, next) => {
  if (isChatSend(req)) return chatLimiter(req, res, next);
  return req.method === 'GET' ? next() : writeLimiter(req, res, next);
});

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'API is breathing' });
});

// ── Feature Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/chats', chatRoutes);

// ── 404 Fallback ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Start Server (HTTP + Socket.IO on the same port) ─────────────────────────
const server = http.createServer(app);
initSocket(server, allowedOrigins);

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
