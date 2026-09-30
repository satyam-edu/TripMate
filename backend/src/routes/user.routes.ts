import express, { Router } from 'express';
import { getMe, getUser, updateMe } from '../controllers/user.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { uploadPhoto, removePhoto } from '../controllers/image.controller';

const router = Router();

// GET   /api/users/me   → the authenticated user's own profile (auth required)
// PATCH /api/users/me   → update the authenticated user's profile (auth required)
// PUT    /api/users/me/photo/:kind → upload profile photo / cover (kind = avatar | cover, raw image body)
// DELETE /api/users/me/photo/:kind → remove it
// GET   /api/users/:id  → get a user's public profile + their hosted trips
router.get('/me', verifyToken, getMe);
router.patch('/me', verifyToken, updateMe);
router.put(
  '/me/photo/:kind',
  verifyToken,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '3mb' }),
  uploadPhoto,
);
router.delete('/me/photo/:kind', verifyToken, removePhoto);
router.get('/:id', getUser);

export default router;
