import express, { Router } from 'express';
import { getMe, getUser, updateMe, verifyPhone } from '../controllers/user.controller';
import { verifyToken, optionalVerifyToken } from '../middlewares/auth.middleware';
import { uploadPhoto, removePhoto } from '../controllers/image.controller';
import { blockUser, unblockUser, reportUser } from '../controllers/safety.controller';

const router = Router();

// GET   /api/users/me   → the authenticated user's own profile (auth required)
// PATCH /api/users/me   → update the authenticated user's profile (auth required)
// PUT    /api/users/me/photo/:kind → upload profile photo / cover (kind = avatar | cover, raw image body)
// DELETE /api/users/me/photo/:kind → remove it
// GET    /api/users/:id  → get a user's public profile + their hosted trips
// POST   /api/users/:id/block  → block a user (mutual: hides each other, blocks contact)
// DELETE /api/users/:id/block  → unblock
// POST   /api/users/:id/report → report a user (reason + optional details)
router.get('/me', verifyToken, getMe);
router.patch('/me', verifyToken, updateMe);
router.post('/me/phone/verify', verifyToken, verifyPhone);
router.put(
  '/me/photo/:kind',
  verifyToken,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '3mb' }),
  uploadPhoto,
);
router.delete('/me/photo/:kind', verifyToken, removePhoto);
router.get('/:id', optionalVerifyToken, getUser);
router.post('/:id/block', verifyToken, blockUser);
router.delete('/:id/block', verifyToken, unblockUser);
router.post('/:id/report', verifyToken, reportUser);

export default router;
