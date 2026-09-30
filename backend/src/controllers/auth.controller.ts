import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    // Google access token from useGoogleLogin on the frontend
    const token = req.body.token;

    if (typeof token !== 'string' || !token) {
      res.status(400).json({ error: 'No token provided by frontend.' });
      return;
    }

    // ── 1. Make sure the token was issued to OUR Google client ───────────────
    // Without this, an access token issued to any other app would log the user in here.
    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
    );
    const info = infoRes.ok ? ((await infoRes.json()) as { aud?: string }) : null;
    if (!info || !process.env.GOOGLE_CLIENT_ID || info.aud !== process.env.GOOGLE_CLIENT_ID) {
      res.status(401).json({ error: 'Invalid Google token.' });
      return;
    }

    // ── 2. Fetch user profile directly from Google ───────────────────────────
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
    if (!googleId) {
      res.status(401).json({ error: 'Invalid Google token.' });
      return;
    }

    // ── 3. Upsert user in the database ───────────────────────────────────────
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

    // ── 4. Sign a JWT ────────────────────────────────────────────────────────
    const jwtSecret = process.env.JWT_SECRET as string;
    const appToken = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // ── 5. Return token + user profile to the frontend ───────────────────────
    res.status(200).json({ token: appToken, user });
  } catch (error) {
    console.error('[googleLogin]', error);
    res.status(500).json({ error: 'Authentication failed.' });
  }
};