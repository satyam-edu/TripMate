import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// POST /api/trips
// Creates a new trip owned by the authenticated user (hostId comes from JWT).
interface CreateTripBody {
  destination?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  budget?: number | string;
  maxGuests?: number | string;
  tags?: string[];
  coverImage?: string;
  description?: string;
}

export const createTrip = async (req: Request, res: Response): Promise<void> => {
  console.log('INCOMING TRIP DATA:', req.body);
  try {
    const hostId = req.userId;
    if (!hostId) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const {
      destination,
      country,
      startDate,
      endDate,
      budget,
      maxGuests,
      tags,
      coverImage,
      description,
    } = req.body as CreateTripBody;

    if (!destination || !country || !startDate || !endDate || budget == null || maxGuests == null) {
      res.status(400).json({
        error: 'destination, country, startDate, endDate, budget, and maxGuests are required.',
      });
      return;
    }

    const parsedStart = new Date(startDate);
    const parsedEnd   = new Date(endDate);
    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      res.status(400).json({ error: 'startDate and endDate must be valid dates.' });
      return;
    }
    if (parsedEnd < parsedStart) {
      res.status(400).json({ error: 'endDate must be after startDate.' });
      return;
    }

    const budgetInt = Math.trunc(Number(budget));
    const guestsInt = Math.trunc(Number(maxGuests));
    if (!Number.isFinite(budgetInt) || budgetInt < 0 || !Number.isFinite(guestsInt) || guestsInt < 1) {
      res.status(400).json({ error: 'budget and maxGuests must be valid positive numbers.' });
      return;
    }

    let finalCoverImage: string = coverImage ?? '';
    if (!finalCoverImage || finalCoverImage.trim() === '') {
      const seed = destination
        ? encodeURIComponent(destination.split(',')[0]!.trim())
        : 'travel';
      finalCoverImage = `https://picsum.photos/seed/${seed}/800/600`;
    }

    const trip = await prisma.trip.create({
      data: {
        hostId,
        destination,
        country,
        startDate:   parsedStart,
        endDate:     parsedEnd,
        budget:      budgetInt,
        maxGuests:   guestsInt,
        tags:        Array.isArray(tags) ? tags : [],
        coverImage:  finalCoverImage,
        description: description && description.trim() !== '' ? description.trim() : null,
      },
    });

    res.status(201).json(trip);
  } catch (error: unknown) {
    console.error('CRITICAL BACKEND ERROR:', error);
    if (isPrismaError(error, 'P2003')) {
      res.status(404).json({ error: 'Host user not found.' });
      return;
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/trips
// Fetches all upcoming trips, excluding the authenticated user's own trips.
// If no token is present (public view), returns all trips.
export const getAllTrips = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const trips = await prisma.trip.findMany({
      where: {
        startDate: { gte: new Date() },
        ...(userId ? { hostId: { not: userId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        host: {
          select: { id: true, name: true, avatar: true },
        },
        _count: {
          // Only APPROVED members count toward filled spots (host is added on the client).
          select: { requests: { where: { status: 'APPROVED' } } },
        },
      },
    });

    res.status(200).json(trips);
  } catch (error) {
    console.error('[getAllTrips]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/trips/hosted
// All trips hosted by the authenticated user (past + upcoming).
export const getHostedTrips = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const trips = await prisma.trip.findMany({
      where: { hostId: userId },
      orderBy: { startDate: 'asc' },
      include: {
        host: { select: { id: true, name: true, avatar: true } },
        _count: { select: { requests: { where: { status: 'APPROVED' } } } },
      },
    });
    res.status(200).json(trips);
  } catch (error) {
    console.error('[getHostedTrips]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/trips/joined
// All trips where the authenticated user has an APPROVED request.
export const getJoinedTrips = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const trips = await prisma.trip.findMany({
      where: { requests: { some: { userId, status: 'APPROVED' } } },
      orderBy: { startDate: 'asc' },
      include: {
        host: { select: { id: true, name: true, avatar: true } },
        _count: { select: { requests: { where: { status: 'APPROVED' } } } },
      },
    });
    res.status(200).json(trips);
  } catch (error) {
    console.error('[getJoinedTrips]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// POST /api/trips/:id/join
// Creates a join request for the authenticated user on the given trip.
export const requestToJoinTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const tripId = req.params.id as string;
    const userId = req.userId as string;

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });

    if (!trip) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }

    if (trip.hostId === userId) {
      res.status(400).json({ error: 'You cannot request to join your own trip.' });
      return;
    }

    await prisma.request.create({
      data: { tripId, userId },
    });

    res.status(200).json({ message: 'Join request sent successfully.' });
  } catch (error: unknown) {
    console.error('CRITICAL BACKEND ERROR:', error);
    if (isPrismaError(error, 'P2002')) {
      res.status(409).json({ error: 'You have already requested to join this trip.' });
      return;
    }
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
