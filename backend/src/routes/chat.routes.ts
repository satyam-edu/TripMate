import { Router } from 'express';
import { getChats, getUnreadCount, getMessages, sendMessage, markChatRead } from '../controllers/chat.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

// All chat routes require authentication. :kind is "groups" (id = tripId) or "inquiries" (id = requestId).
// GET  /api/chats                     → every chat the user belongs to (+ latest message, unread count)
// GET  /api/chats/unread-count        → total unread across all chats
// GET  /api/chats/:kind/:id/messages  → recent messages of one chat
// POST /api/chats/:kind/:id/messages  → send a message (pushed live over Socket.IO)
// POST /api/chats/:kind/:id/read      → mark the chat as read up to now
router.get('/', verifyToken, getChats);
router.get('/unread-count', verifyToken, getUnreadCount);
router.get('/:kind/:id/messages', verifyToken, getMessages);
router.post('/:kind/:id/messages', verifyToken, sendMessage);
router.post('/:kind/:id/read', verifyToken, markChatRead);

export default router;
