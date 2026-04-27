import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// POST /api/trips
// Creates a new trip. Requires destination, dates, budget, maxGuests, and hostId.
export const createTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hostId, destination, country, startDate, endDate, budget, maxGuests, tags } = req.body;

    if (!hostId || !destination || !country || !startDate || !endDate || budget == null || !maxGuests) {
      res.status(400).json({
        error: 'hostId, destination, country, startDate, endDate, budget, and maxGuests are required.',
      });
      return;
    }

    const trip = await prisma.trip.create({
      data: {
        hostId,
        destination,
        country,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        budget: Number(budget),
        maxGuests: Number(maxGuests),
        tags: tags ?? [],
      },
    });

    res.status(201).json(trip);
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2003')) {
      res.status(404).json({ error: 'Host user not found.' });
      return;
    }
    console.error('[createTrip]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/trips
// Fetches all upcoming trips (startDate >= today), including the host's name and avatar.
export const getAllTrips = async (_req: Request, res: Response): Promise<void> => {
  try {
    const trips = await prisma.trip.findMany({
      where: {
        startDate: { gte: new Date() },
      },
      orderBy: { startDate: 'asc' },
      include: {
        host: {
          select: { id: true, name: true, avatar: true },
        },
        _count: {
          select: { requests: true },
        },
      },
    });

    res.status(200).json(trips);
  } catch (error) {
    console.error('[getAllTrips]', error);
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
