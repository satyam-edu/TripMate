import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { isValidTags } from '../utils';
import { blockedUserIds } from './safety.controller';

const FEED_PAGE_SIZE = 12;

interface TripBody {
  destination?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  budget?: number | string;
  maxGuests?: number | string;
  tags?: string[];
  coverImage?: string;
  description?: string;
  womenOnly?: boolean;
}

// Validates a create/edit body. Returns the clean data, or an error message.
function parseTripBody(body: TripBody) {
  const { destination, country, startDate, endDate, budget, maxGuests, tags, coverImage, description, womenOnly } = body;

  if (!destination || !country || !startDate || !endDate || budget == null || maxGuests == null) {
    return { error: 'destination, country, startDate, endDate, budget, and maxGuests are required.' };
  }
  if (
    destination.length > 100 ||
    country.length > 100 ||
    (description?.length ?? 0) > 2000 ||
    (coverImage?.length ?? 0) > 1000
  ) {
    return { error: 'One or more fields are too long.' };
  }
  if (tags !== undefined && !isValidTags(tags)) {
    return { error: 'tags must be up to 12 short text values.' };
  }

  const parsedStart = new Date(startDate);
  const parsedEnd   = new Date(endDate);
  if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
    return { error: 'startDate and endDate must be valid dates.' };
  }
  if (parsedEnd < parsedStart) {
    return { error: 'endDate must be after startDate.' };
  }

  const budgetInt = Math.trunc(Number(budget));
  const guestsInt = Math.trunc(Number(maxGuests));
  if (!Number.isFinite(budgetInt) || budgetInt < 0 || !Number.isFinite(guestsInt) || guestsInt < 1) {
    return { error: 'budget and maxGuests must be valid positive numbers.' };
  }

  let finalCoverImage: string = coverImage ?? '';
  if (!finalCoverImage || finalCoverImage.trim() === '') {
    const seed = encodeURIComponent(destination.split(',')[0]!.trim() || 'travel');
    finalCoverImage = `https://picsum.photos/seed/${seed}/800/600`;
  }

  return {
    data: {
      destination,
      country,
      startDate:   parsedStart,
      endDate:     parsedEnd,
      budget:      budgetInt,
      maxGuests:   guestsInt,
      tags:        tags ?? [],
      coverImage:  finalCoverImage,
      description: description && description.trim() !== '' ? description.trim() : null,
      womenOnly:   womenOnly === true,
    },
  };
}

// POST /api/trips
// Creates a new trip owned by the authenticated user (hostId comes from JWT).
export const createTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostId = req.userId;
    if (!hostId) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const parsed = parseTripBody(req.body as TripBody);
    if (!parsed.data) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    // Only a host who identifies as a woman can mark a trip women-only.
    if (parsed.data.womenOnly) {
      const host = await prisma.user.findUnique({ where: { id: hostId }, select: { gender: true } });
      if (host?.gender !== 'Woman') {
        res.status(400).json({ error: 'Only travellers with gender set to Woman can post women-only trips.' });
        return;
      }
    }

    const trip = await prisma.trip.create({ data: { hostId, ...parsed.data } });
    res.status(201).json(trip);
  } catch (error: unknown) {
    console.error('[createTrip]', error);
    if (isPrismaError(error, 'P2003')) {
      res.status(404).json({ error: 'Host user not found.' });
      return;
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// PATCH /api/trips/:id
// Host edits their trip. Takes the same full body as create.
export const updateTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { _count: { select: { requests: { where: { status: 'APPROVED' } } } } },
    });
    if (!trip) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }
    if (trip.hostId !== req.userId) {
      res.status(403).json({ error: 'Only the host can edit this trip.' });
      return;
    }

    const parsed = parseTripBody(req.body as TripBody);
    if (!parsed.data) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    if (parsed.data.womenOnly) {
      const host = await prisma.user.findUnique({ where: { id: trip.hostId }, select: { gender: true } });
      if (host?.gender !== 'Woman') {
        res.status(400).json({ error: 'Only travellers with gender set to Woman can post women-only trips.' });
        return;
      }
    }
    // Host takes one spot; can't shrink below the people already approved.
    if (parsed.data.maxGuests < trip._count.requests + 1) {
      res.status(400).json({ error: `maxGuests can't be less than ${trip._count.requests + 1} (people already going).` });
      return;
    }

    const updated = await prisma.trip.update({ where: { id }, data: parsed.data });
    res.status(200).json(updated);
  } catch (error) {
    console.error('[updateTrip]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// DELETE /api/trips/:id
// Host deletes their trip (and all its join requests).
export const deleteTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }
    if (trip.hostId !== req.userId) {
      res.status(403).json({ error: 'Only the host can delete this trip.' });
      return;
    }

    await prisma.$transaction([
      prisma.request.deleteMany({ where: { tripId: id } }),
      prisma.trip.delete({ where: { id } }),
    ]);
    res.status(204).end();
  } catch (error) {
    console.error('[deleteTrip]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/trips
// Fetches upcoming trips page by page, excluding the authenticated user's own trips.
// If logged in, each trip also carries `requests: [{ status }]`, the user's own request, if any.
// Query params (all optional): q (destination/country/description text), category (a tag),
// minBudget, maxBudget, startDate, endDate (only trips within this window), cursor (last trip id from the previous page).
export const getAllTrips = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const hidden = userId ? await blockedUserIds(userId) : new Set<string>();
    const { q, category, minBudget, maxBudget, startDate, endDate, cursor } = req.query as Record<string, string | undefined>;

    const where: Prisma.TripWhereInput = {
      startDate: { gte: new Date() },
      ...(userId ? { hostId: { not: userId } } : {}),
      ...(hidden.size > 0 ? { hostId: { notIn: [...hidden] } } : {}),
    };

    if (q && q.trim()) {
      const text = q.trim().slice(0, 100);
      where.OR = [
        { destination: { contains: text, mode: 'insensitive' } },
        { country: { contains: text, mode: 'insensitive' } },
        { description: { contains: text, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.tags = { has: category.slice(0, 40) };
    }
    const min = minBudget !== undefined ? Number(minBudget) : NaN;
    const max = maxBudget !== undefined ? Number(maxBudget) : NaN;
    if (Number.isFinite(min) || Number.isFinite(max)) {
      where.budget = {
        ...(Number.isFinite(min) ? { gte: min } : {}),
        ...(Number.isFinite(max) ? { lte: max } : {}),
      };
    }
    if (startDate) {
      const d = new Date(startDate);
      if (!Number.isNaN(d.getTime()) && d > new Date()) {
        where.startDate = { gte: d };
      }
    }
    if (endDate) {
      const d = new Date(endDate);
      if (!Number.isNaN(d.getTime())) where.endDate = { lte: d };
    }

    const trips = await prisma.trip.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: FEED_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        host: {
          select: { id: true, name: true, avatar: true },
        },
        _count: {
          // Only APPROVED members count toward filled spots (host is added on the client).
          select: { requests: { where: { status: 'APPROVED' } } },
        },
        ...(userId ? { requests: { where: { userId }, select: { status: true } } } : {}),
      },
    });

    const hasMore = trips.length > FEED_PAGE_SIZE;
    const page = trips.slice(0, FEED_PAGE_SIZE);
    res.status(200).json({ trips: page, nextCursor: hasMore ? page[page.length - 1]!.id : null });
  } catch (error) {
    console.error('[getAllTrips]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/trips/:id
// One trip's detail page: host card, who's going, and the viewer's own request (if any).
export const getTrip = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const userId = req.userId as string;
    const [trip, myRequest] = await Promise.all([
      prisma.trip.findUnique({
        where: { id },
        include: {
          host: { select: { id: true, name: true, avatar: true, bio: true, location: true, socialHandle: true } },
          requests: {
            where: { status: 'APPROVED' },
            orderBy: { createdAt: 'asc' },
            select: { user: { select: { id: true, name: true, avatar: true } } },
          },
        },
      }),
      prisma.request.findUnique({ where: { tripId_userId: { tripId: id, userId } }, select: { id: true, status: true } }),
    ]);
    if (!trip) {
      res.status(404).json({ error: 'Trip not found.' });
      return;
    }

    const { requests, ...rest } = trip;
    res.status(200).json({ ...rest, members: requests.map((r) => r.user), myRequest });
  } catch (error) {
    console.error('[getTrip]', error);
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

    // A single grouped count of PENDING requests across all of this host's trips
    // (Prisma's `_count` can only carry one filter per relation, so this is a second query).
    const pending = await prisma.request.groupBy({
      by: ['tripId'],
      where: { tripId: { in: trips.map((t) => t.id) }, status: 'PENDING' },
      _count: true,
    });
    const pendingByTrip = new Map(pending.map((p) => [p.tripId, p._count]));

    res.status(200).json(trips.map((t) => ({ ...t, pendingCount: pendingByTrip.get(t.id) ?? 0 })));
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

// ── Helper ────────────────────────────────────────────────────────────────────
function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === code
  );
}
