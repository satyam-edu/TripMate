import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// POST /api/users
// Creates a new user. Takes googleId, name, and optionally phone/gender/avatar/bio/tags.
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { googleId, name, phone, gender, avatar, bio, tags } = req.body;

    if (!googleId || !name) {
      res.status(400).json({ error: 'googleId and name are required.' });
      return;
    }

    const user = await prisma.user.create({
      data: {
        googleId,
        name,
        phone: phone ?? null,
        gender: gender ?? null,
        avatar: avatar ?? null,
        bio: bio ?? null,
        tags: tags ?? [],
      },
    });

    res.status(201).json(user);
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      res.status(409).json({ error: 'A user with this googleId or phone already exists.' });
      return;
    }
    console.error('[createUser]', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /api/users/:id
// Fetches a user by their ID, including all trips they have hosted.
export const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        trips: {
          orderBy: { startDate: 'asc' },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('[getUser]', error);
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
