import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

// Real-time push for chat. Clients only *receive* over the socket; sending goes
// through POST /api/chats/... so auth, validation and rate limits stay in one place.
// Each connected user joins a private room `user:<id>`.

let io: Server | null = null;

export function initSocket(server: HttpServer, allowedOrigins: string[]): void {
  io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } });

  // Same JWT as the REST API, sent as `auth: { token }` from the client.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const secret = process.env.JWT_SECRET;
    if (typeof token !== 'string' || !secret) return next(new Error('Unauthorized'));
    try {
      const { userId } = jwt.verify(token, secret) as { userId: string };
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    void socket.join(`user:${socket.data.userId}`);
  });
}

// Push an event to every connected tab of each given user.
export function emitToUsers(userIds: string[], event: string, payload: unknown): void {
  if (!io) return;
  io.to(userIds.map((id) => `user:${id}`)).emit(event, payload);
}
