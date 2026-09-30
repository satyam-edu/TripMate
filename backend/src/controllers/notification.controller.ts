import { Request, Response } from 'express';
import type { NotificationType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { emitToUsers } from '../socket';

// Saves a notification and pushes it live to the user's open tabs.
// Never throws: a failed notification must not break the action that caused it.
export async function notify(userId: string, type: NotificationType, text: string, link: string): Promise<void> {
  try {
    const notification = await prisma.notification.create({ data: { userId, type, text, link } });
    emitToUsers([userId], 'notification', notification);
  } catch (error) {
    console.error('[notify]', error);
  }
}

// GET /api/notifications
// The user's latest 30 notifications + how many are unread.
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);
    res.status(200).json({ items, unread });
  } catch (error) {
    console.error('[getNotifications]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// POST /api/notifications/read-all
export const markAllRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.userId as string, read: false }, data: { read: true } });
    res.status(204).end();
  } catch (error) {
    console.error('[markAllRead]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
