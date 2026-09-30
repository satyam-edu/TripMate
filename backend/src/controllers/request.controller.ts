import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { notify } from './notification.controller';
import { isBlockedEitherWay } from './safety.controller';
import { sendEmail } from '../services/email';
import { isPrismaError } from '../utils';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
const VALID_STATUSES: RequestStatus[] = ['APPROVED', 'REJECTED'];

// POST /api/requests
// Creates a PENDING join request. userId is derived from the JWT.
export const createRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { tripId, message } = req.body as { tripId?: string; message?: string };

    if (!tripId) {
      res.status(400).json({ error: 'tripId is required.' });
      return;
    }

    if (typeof message === 'string' && message.length > 500) {
      res.status(400).json({ error: 'Message must be 500 characters or less.' });
      return;
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        host: { select: { email: true } },
        _count: { select: { requests: { where: { status: 'APPROVED' } } } },
      },
    });
    if (!trip) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }
    if (trip.hostId === userId) {
      res.status(400).json({ error: 'You cannot request to join your own trip.' });
      return;
    }
    // Deliberately the same generic message either way — never reveals a block.
    if (await isBlockedEitherWay(userId, trip.hostId)) {
      res.status(400).json({ error: "You can't join this trip." });
      return;
    }
    if (trip.startDate <= new Date()) {
      res.status(400).json({ error: 'This trip has already started.' });
      return;
    }
    if (trip.womenOnly) {
      const requester = await prisma.user.findUnique({ where: { id: userId }, select: { gender: true } });
      if (requester?.gender !== 'Woman') {
        res.status(400).json({ error: 'This trip is only open to women.' });
        return;
      }
    }
    if (isFull(trip.maxGuests, trip._count.requests)) {
      res.status(400).json({ error: 'This trip is already full.' });
      return;
    }

    const joinRequest = await prisma.request.create({
      data: {
        tripId,
        userId,
        status: 'PENDING',
        message: typeof message === 'string' && message.trim() !== '' ? message.trim() : null,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        trip: { select: { id: true, destination: true, country: true } },
      },
    });

    await notify(
      trip.hostId,
      'NEW_REQUEST',
      `${joinRequest.user.name} requested to join ${joinRequest.trip.destination}`,
      '/requests',
    );
    await sendEmail(
      trip.host.email,
      `New request to join ${joinRequest.trip.destination}`,
      `<p><strong>${joinRequest.user.name}</strong> asked to join your trip to <strong>${joinRequest.trip.destination}</strong>.</p>
       <p><a href="${process.env.FRONTEND_URL ?? ''}/requests">View the request on TripMate</a></p>`,
    );

    res.status(201).json(joinRequest);
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      res.status(409).json({ error: 'You have already sent a request for this trip.' });
      return;
    }
    console.error('[createRequest]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/requests/received
// Returns PENDING requests for all trips hosted by the authenticated user.
export const getReceivedRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;

    const requests = await prisma.request.findMany({
      where: {
        status: 'PENDING',
        trip: { hostId: userId },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        trip: { select: { id: true, destination: true, country: true, startDate: true } },
      },
    });

    res.status(200).json(requests);
  } catch (error) {
    console.error('[getReceivedRequests]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/requests/sent
// Returns all requests sent by the authenticated user.
export const getSentRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;

    const requests = await prisma.request.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        trip: {
          select: {
            id: true,
            destination: true,
            country: true,
            startDate: true,
            coverImage: true,
            host: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });

    res.status(200).json(requests);
  } catch (error) {
    console.error('[getSentRequests]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// PATCH /api/requests/:id
// Host approves or rejects a request.
export const updateRequestStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { status } = req.body as { status?: RequestStatus };

    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}.` });
      return;
    }

    // Only the host of the trip may approve/reject its requests.
    const existing = await prisma.request.findUnique({
      where: { id },
      include: {
        user: { select: { email: true } },
        trip: {
          select: {
            hostId: true,
            destination: true,
            maxGuests: true,
            _count: { select: { requests: { where: { status: 'APPROVED' } } } },
          },
        },
      },
    });
    if (!existing) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }
    if (existing.trip.hostId !== req.userId) {
      res.status(403).json({ error: 'Only the trip host can update this request.' });
      return;
    }
    // ponytail: count-then-update isn't atomic; two approvals in the same instant could
    // overbook by one. Move into a serializable transaction if that ever matters.
    if (
      status === 'APPROVED' &&
      existing.status !== 'APPROVED' &&
      isFull(existing.trip.maxGuests, existing.trip._count.requests)
    ) {
      res.status(400).json({ error: 'This trip is already full.' });
      return;
    }

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: { status },
    });

    // Tell the traveller, only when the decision actually changed.
    if (existing.status !== status) {
      const approved = status === 'APPROVED';
      await notify(
        existing.userId,
        approved ? 'REQUEST_APPROVED' : 'REQUEST_DECLINED',
        approved
          ? `Your request for ${existing.trip.destination} was accepted!`
          : `Your request for ${existing.trip.destination} was declined.`,
        '/requests?tab=sent',
      );
      await sendEmail(
        existing.user.email,
        approved ? `You're going to ${existing.trip.destination}! 🎉` : `Update on your ${existing.trip.destination} request`,
        approved
          ? `<p>Good news — your request to join <strong>${existing.trip.destination}</strong> was accepted!</p>
             <p><a href="${process.env.FRONTEND_URL ?? ''}/requests?tab=sent">See it on TripMate</a></p>`
          : `<p>Your request to join <strong>${existing.trip.destination}</strong> was declined.</p>
             <p><a href="${process.env.FRONTEND_URL ?? ''}/">Find another trip on TripMate</a></p>`,
      );
    }

    res.status(200).json(updatedRequest);
  } catch (error: unknown) {
    console.error('[updateRequestStatus]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// DELETE /api/requests/:id
// The requester cancels a pending request, or leaves a trip they were approved for.
// Declined requests can't be deleted, otherwise a declined user could just ask again.
export const cancelRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const existing = await prisma.request.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }
    if (existing.status === 'REJECTED') {
      res.status(400).json({ error: 'A declined request cannot be cancelled.' });
      return;
    }

    await prisma.request.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('[cancelRequest]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
// Host takes one spot, so the trip is full when approved + 1 >= maxGuests.
function isFull(maxGuests: number, approvedCount: number): boolean {
  return approvedCount + 1 >= maxGuests;
}

