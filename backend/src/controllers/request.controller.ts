import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

const VALID_STATUSES = ['ACCEPTED', 'DECLINED'] as const;
type RequestStatus = (typeof VALID_STATUSES)[number];

// POST /api/requests
// Creates a PENDING join request from a user to a trip.
export const sendRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tripId, userId, message } = req.body;

    if (!tripId || !userId) {
      res.status(400).json({ error: 'tripId and userId are required.' });
      return;
    }

    const joinRequest = await prisma.request.create({
      data: {
        tripId,
        userId,
        message: message ?? null,
        status: 'PENDING',
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        trip: { select: { id: true, destination: true } },
      },
    });

    res.status(201).json(joinRequest);
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      // @@unique([tripId, userId]) constraint violation — duplicate request
      res.status(409).json({ error: 'You have already sent a request for this trip.' });
      return;
    }
    if (isPrismaError(error, 'P2003')) {
      res.status(404).json({ error: 'Trip or user not found.' });
      return;
    }
    console.error('[sendRequest]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// PATCH /api/requests/:id
// Updates the status of a request to ACCEPTED or DECLINED.
export const updateRequestStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status as RequestStatus)) {
      res.status(400).json({
        error: `Status must be one of: ${VALID_STATUSES.join(', ')}.`,
      });
      return;
    }

    const updatedRequest = await prisma.request.update({
      where: { id },
      data: { status },
    });

    res.status(200).json(updatedRequest);
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2025')) {
      // Record not found
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
