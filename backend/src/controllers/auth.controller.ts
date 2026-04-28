import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    // ── Diagnostic Log: Let's see exactly what the frontend sent ──
    console.log('FRONTEND PAYLOAD:', req.body);

    // Grab the token, no matter what the IDE Agent named it
    const token = req.body.idToken || req.body.access_token || req.body.token || req.body.credential || req.body.code;

    if (!token) {
      res.status(400).json({ error: 'No token provided by frontend.' });
      return;
    }

    // ── 1. Fetch user profile directly from Google ───────────────────────────
    // This endpoint accepts Access Tokens seamlessly without the strict JWT crash
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      console.error('Google rejected the token:', await response.text());
      res.status(401).json({ error: 'Invalid Google token.' });
      return;
    }

    const payload = await response.json() as any;
    const { sub: googleId, name, picture: avatar } = payload;

    // ── 2. Upsert user in the database ───────────────────────────────────────
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

    // ── 3. Sign a JWT ────────────────────────────────────────────────────────
    const jwtSecret = process.env.JWT_SECRET as string;
    const appToken = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: '30d' }
    );

    // ── 4. Return token + user profile to the frontend ───────────────────────
    res.status(200).json({ token: appToken, user });
  } catch (error) {
    console.error('[googleLogin]', error);
    res.status(500).json({ error: 'Authentication failed.' });
  }
};