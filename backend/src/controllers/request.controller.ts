import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
const VALID_STATUSES: RequestStatus[] = ['APPROVED', 'REJECTED'];

// POST /api/requests
// Creates a PENDING join request. userId is derived from the JWT.
export const createRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { tripId } = req.body as { tripId?: string };

    if (!tripId) {
      res.status(400).json({ error: 'tripId is required.' });
      return;
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }
    if (trip.hostId === userId) {
      res.status(400).json({ error: 'You cannot request to join your own trip.' });
      return;
    }

    const joinRequest = await prisma.request.create({
      data: { tripId, userId, status: 'PENDING' },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        trip: { select: { id: true, destination: true, country: true } },
      },
    });

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

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: { status },
    });

    res.status(200).json(updatedRequest);
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2025')) {
      res.status(404).json({ error: 'Request not found.' });
      return;
    }
    console.error('[updateRequestStatus]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// ── Helper ────────────────────────────────────────────────────────────────────
function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === code
  );
}
