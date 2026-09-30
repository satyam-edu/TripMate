import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { notify } from './notification.controller';

// Reviews run between every pair of trip members (host and travellers alike),
// and only once the trip has ended.
// Who the given user may review on a trip, and who has reviewed them already.
async function reviewablePeople(tripId: string, userId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      hostId: true,
      endDate: true,
      host: { select: { id: true, name: true, avatar: true } },
      requests: {
        where: { status: 'APPROVED' },
        select: { user: { select: { id: true, name: true, avatar: true } } },
      },
    },
  });
  if (!trip || trip.endDate > new Date()) return null;

  const members = [trip.host, ...trip.requests.map((r) => r.user)];
  const isMember = members.some((m) => m.id === userId);
  if (!isMember) return null;

  // Everyone who was actually on the trip can review everyone else on it.
  const reviewable = members.filter((m) => m.id !== userId);
  return { reviewable };
}

// GET /api/trips/:id/reviews
// Who this user can still review on this trip, and the reviews already left about the trip.
export const getTripReviewState = async (req: Request, res: Response): Promise<void> => {
  try {
    const tripId = req.params['id'] as string;
    const userId = req.userId as string;

    const state = await reviewablePeople(tripId, userId);
    if (!state) {
      res.status(200).json({ eligible: false, pending: [], given: [] });
      return;
    }

    const given = await prisma.review.findMany({
      where: { tripId, reviewerId: userId },
      select: {
        id: true,
        revieweeId: true,
        rating: true,
        text: true,
        reviewee: { select: { id: true, name: true, avatar: true } },
      },
    });
    const reviewedIds = new Set(given.map((r) => r.revieweeId));

    res.status(200).json({
      eligible: true,
      pending: state.reviewable.filter((p) => !reviewedIds.has(p.id)),
      given,
    });
  } catch (error) {
    console.error('[getTripReviewState]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// POST /api/trips/:id/reviews
// Body: { revieweeId, rating (1-5), text? }
export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const tripId = req.params['id'] as string;
    const reviewerId = req.userId as string;
    const { revieweeId, rating, text } = req.body as { revieweeId?: string; rating?: number; text?: string };

    if (!revieweeId || !Number.isInteger(rating) || rating! < 1 || rating! > 5) {
      res.status(400).json({ error: 'revieweeId and a rating from 1 to 5 are required.' });
      return;
    }
    if (typeof text === 'string' && text.length > 500) {
      res.status(400).json({ error: 'Review text must be 500 characters or less.' });
      return;
    }

    const state = await reviewablePeople(tripId, reviewerId);
    if (!state || !state.reviewable.some((p) => p.id === revieweeId)) {
      res.status(400).json({ error: "You can't review this person for this trip." });
      return;
    }

    const review = await prisma.review.create({
      data: {
        tripId,
        reviewerId,
        revieweeId,
        rating: rating as number,
        text: typeof text === 'string' && text.trim() !== '' ? text.trim() : null,
      },
    });

    const reviewer = await prisma.user.findUnique({ where: { id: reviewerId }, select: { name: true } });
    await notify(revieweeId, 'REVIEW_RECEIVED', `${reviewer?.name ?? 'Someone'} left you a review`, `/users/${revieweeId}`);

    res.status(201).json(review);
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      res.status(409).json({ error: 'You already reviewed this person for this trip.' });
      return;
    }
    console.error('[createReview]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// PATCH /api/trips/:id/reviews/:reviewId
// The reviewer edits their own rating/text.
export const updateReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const reviewId = req.params['reviewId'] as string;
    const reviewerId = req.userId as string;
    const { rating, text } = req.body as { rating?: number; text?: string };

    if (!Number.isInteger(rating) || rating! < 1 || rating! > 5) {
      res.status(400).json({ error: 'rating must be a whole number from 1 to 5.' });
      return;
    }
    if (typeof text === 'string' && text.length > 500) {
      res.status(400).json({ error: 'Review text must be 500 characters or less.' });
      return;
    }

    const existing = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing || existing.reviewerId !== reviewerId) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }

    const review = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating: rating as number,
        text: typeof text === 'string' && text.trim() !== '' ? text.trim() : null,
      },
    });
    res.status(200).json(review);
  } catch (error) {
    console.error('[updateReview]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// DELETE /api/trips/:id/reviews/:reviewId
// The reviewer deletes their own review.
export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const reviewId = req.params['reviewId'] as string;
    const reviewerId = req.userId as string;

    const existing = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!existing || existing.reviewerId !== reviewerId) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }

    await prisma.review.delete({ where: { id: reviewId } });
    res.status(204).end();
  } catch (error) {
    console.error('[deleteReview]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

function isPrismaError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === code;
}
