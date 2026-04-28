import { Request, Response } from 'express';
import { OAuth2Client, LoginTicket } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';

const googleClientId = process.env.GOOGLE_CLIENT_ID as string;
const client = new OAuth2Client(googleClientId);

// POST /api/auth/google
// Receives a Google ID token from the frontend, verifies it, upserts the user,
// and returns a signed JWT alongside the user record.
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ error: 'idToken is required.' });
      return;
    }

    // ── 1. Verify the Google ID token ──────────────────────────────────────────
    // audience must be a string (not undefined) — we assert it above at module scope.
    let ticket: LoginTicket;
    try {
      ticket = await client.verifyIdToken({
        idToken: idToken as string,
        audience: googleClientId,
      });
    } catch {
      res.status(401).json({ error: 'Invalid Google token.' });
      return;
    }

    const payload = ticket.getPayload();

    if (!payload || !payload.sub) {
      res.status(401).json({ error: 'Google token payload is empty.' });
      return;
    }

    const { sub: googleId, name, picture: avatar } = payload;

    // ── 2. Upsert user in the database ─────────────────────────────────────────
    // Returning user → refresh name & avatar. New user → create fresh record.
    const user = await prisma.user.upsert({
      where: { googleId },
      update: {
        name: name ?? 'Traveller',
        avatar: avatar ?? null,
      },
      create: {
        googleId,
        name: name ?? 'Traveller',
        avatar: avatar ?? null,
      },
    });

    // ── 3. Sign a JWT containing the internal database user ID ─────────────────
    const jwtSecret = process.env.JWT_SECRET as string;

    const token = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: '30d' }
    );

    // ── 4. Return token + user profile to the frontend ─────────────────────────
    res.status(200).json({ token, user });
  } catch (error) {
    console.error('[googleLogin]', error);
    res.status(500).json({ error: 'Authentication failed.' });
  }
};
