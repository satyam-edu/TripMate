import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express's Request type so downstream route handlers can access req.userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

interface JwtPayload {
  userId: string;
}

// Middleware: verifyToken
// Checks for a valid JWT in the Authorization header (Bearer <token>).
// On success  → attaches the decoded userId to req.userId and calls next().
// On failure  → returns 401 Unauthorized immediately.
export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Malformed Authorization header.' });
    return;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET missing.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    // Catches both TokenExpiredError and JsonWebTokenError
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
  }
};
