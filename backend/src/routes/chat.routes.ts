import { Router } from 'express';
import { getChats, getMessages, sendMessage } from '../controllers/chat.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

// All chat routes require authentication. :kind is "groups" (id = tripId) or "inquiries" (id = requestId).
// GET  /api/chats                     → every chat the user belongs to (+ latest message)
// GET  /api/chats/:kind/:id/messages  → recent messages of one chat
// POST /api/chats/:kind/:id/messages  → send a message (pushed live over Socket.IO)
router.get('/', verifyToken, getChats);
router.get('/:kind/:id/messages', verifyToken, getMessages);
router.post('/:kind/:id/messages', verifyToken, sendMessage);

export default router;
