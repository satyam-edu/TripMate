import { Request, Response } from 'express';
import type { ReportReason } from '@prisma/client';
import { prisma } from '../config/prisma';

const REPORT_REASONS: ReportReason[] = ['SPAM', 'HARASSMENT', 'FAKE_PROFILE', 'SAFETY_CONCERN', 'OTHER'];

// Blocking is mutual: if either person has blocked the other, treat them as blocked.
// A blocked person is never told which of the two did the blocking — that stays private,
// same as most apps — their actions just quietly fail or the content disappears.
export async function isBlockedEitherWay(userA: string, userB: string): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    select: { id: true },
  });
  return block !== null;
}

// Every user id blocked-either-way with the given user (for filtering feeds/lists).
export async function blockedUserIds(userId: string): Promise<Set<string>> {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId)));
}

// POST /api/users/:id/block
export const blockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const blockerId = req.userId as string;
    const blockedId = req.params['id'] as string;
    if (blockedId === blockerId) {
      res.status(400).json({ error: "You can't block yourself." });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });

    // Any open request between the two of them is quietly declined — no notification,
    // so blocking doesn't tip the other person off.
    await prisma.request.updateMany({
      where: {
        status: 'PENDING',
        OR: [
          { userId: blockerId, trip: { hostId: blockedId } },
          { userId: blockedId, trip: { hostId: blockerId } },
        ],
      },
      data: { status: 'REJECTED' },
    });

    res.status(200).json({ blocked: true });
  } catch (error) {
    console.error('[blockUser]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// DELETE /api/users/:id/block
export const unblockUser = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.block.deleteMany({ where: { blockerId: req.userId as string, blockedId: req.params['id'] as string } });
    res.status(200).json({ blocked: false });
  } catch (error) {
    console.error('[unblockUser]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// POST /api/users/:id/report   body: { reason, details? }
export const reportUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const reporterId = req.userId as string;
    const reportedId = req.params['id'] as string;
    const { reason, details } = req.body as { reason?: ReportReason; details?: string };

    if (reportedId === reporterId) {
      res.status(400).json({ error: "You can't report yourself." });
      return;
    }
    if (!reason || !REPORT_REASONS.includes(reason)) {
      res.status(400).json({ error: `reason must be one of: ${REPORT_REASONS.join(', ')}.` });
      return;
    }
    if (typeof details === 'string' && details.length > 1000) {
      res.status(400).json({ error: 'Details must be 1000 characters or less.' });
      return;
    }
    const target = await prisma.user.findUnique({ where: { id: reportedId }, select: { id: true } });
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    await prisma.report.create({
      data: {
        reporterId,
        reportedId,
        reason,
        details: typeof details === 'string' && details.trim() !== '' ? details.trim() : null,
      },
    });

    // ponytail: no admin UI yet to review these — read the Report table directly.
    // Add a moderation dashboard once report volume makes that worth building.
    res.status(201).json({ reported: true });
  } catch (error) {
    console.error('[reportUser]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
