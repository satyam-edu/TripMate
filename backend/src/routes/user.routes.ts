import { Router } from 'express';
import { createUser, getUser, updateMe } from '../controllers/user.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

// POST  /api/users      → create a new user
// PATCH /api/users/me   → update the authenticated user's profile (auth required)
// GET   /api/users/:id  → get a user + their hosted trips
router.post('/', createUser);
router.patch('/me', verifyToken, updateMe);
router.get('/:id', getUser);

export default router;
