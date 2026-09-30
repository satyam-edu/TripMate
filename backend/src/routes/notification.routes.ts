import { Router } from 'express';
import { getNotifications, markAllRead } from '../controllers/notification.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

// GET  /api/notifications           → latest 30 + unread count
// POST /api/notifications/read-all  → mark all as read
router.get('/', verifyToken, getNotifications);
router.post('/read-all', verifyToken, markAllRead);

export default router;
