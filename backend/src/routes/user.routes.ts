import { Router } from 'express';
import { getMe, getUser, updateMe } from '../controllers/user.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

// GET   /api/users/me   → the authenticated user's own profile (auth required)
// PATCH /api/users/me   → update the authenticated user's profile (auth required)
// GET   /api/users/:id  → get a user's public profile + their hosted trips
router.get('/me', verifyToken, getMe);
router.patch('/me', verifyToken, updateMe);
router.get('/:id', getUser);

export default router;
