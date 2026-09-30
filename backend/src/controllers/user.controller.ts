import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { isValidTags } from '../utils';

// GET /api/users/:id
// Public profile: only safe fields (no phone / googleId / gender) + hosted trips.
export const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatar: true,
        coverImage: true,
        bio: true,
        location: true,
        socialHandle: true,
        tags: true,
        createdAt: true,
        trips: {
          orderBy: { startDate: 'asc' },
        },
        reviewsReceived: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            rating: true,
            text: true,
            createdAt: true,
            trip: { select: { id: true, destination: true } },
            reviewer: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const { reviewsReceived, ...rest } = user;
    const avgRating =
      reviewsReceived.length > 0
        ? Math.round((reviewsReceived.reduce((sum, r) => sum + r.rating, 0) / reviewsReceived.length) * 10) / 10
        : null;

    // Only tells the viewer whether *they* blocked this person, never the reverse — a
    // blocked person is never told they were the one blocked.
    const blockedByMe = req.userId
      ? (await prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: req.userId, blockedId: id } } })) !== null
      : false;

    res.status(200).json({ ...rest, reviews: reviewsReceived, avgRating, blockedByMe });
  } catch (error) {
    console.error('[getUser]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/users/me
// The authenticated user's own full profile (used to refresh the app's cached copy).
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('[getMe]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// PATCH /api/users/me
// Updates the authenticated user's editable profile fields (Trust Center).
export const updateMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { bio, location, socialHandle, tags, gender } = req.body as {
      bio?: string;
      location?: string;
      socialHandle?: string;
      tags?: string[];
      gender?: string;
    };

    if ((bio?.length ?? 0) > 500 || (location?.length ?? 0) > 100 || (socialHandle?.length ?? 0) > 200) {
      res.status(400).json({ error: 'One or more fields are too long.' });
      return;
    }
    if (tags !== undefined && !isValidTags(tags)) {
      res.status(400).json({ error: 'tags must be up to 12 short text values.' });
      return;
    }
    const GENDERS = ['Woman', 'Man', 'Prefer not to say'];
    if (gender !== undefined && gender !== '' && !GENDERS.includes(gender)) {
      res.status(400).json({ error: `gender must be one of: ${GENDERS.join(', ')}.` });
      return;
    }

    const clean = (v?: string) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

    const data: {
      bio?: string | null;
      location?: string | null;
      socialHandle?: string | null;
      tags?: string[];
      gender?: string | null;
    } = {};
    if (bio !== undefined) data.bio = clean(bio);
    if (location !== undefined) data.location = clean(location);
    if (socialHandle !== undefined) data.socialHandle = clean(socialHandle);
    if (tags !== undefined) data.tags = tags;
    if (gender !== undefined) data.gender = clean(gender);

    const user = await prisma.user.update({ where: { id: userId }, data });
    res.status(200).json(user);
  } catch (error) {
    console.error('[updateMe]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
