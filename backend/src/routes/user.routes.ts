import { Router } from 'express';
import { createUser, getUser } from '../controllers/user.controller';

const router = Router();

// POST /api/users       → create a new user
// GET  /api/users/:id  → get a user + their hosted trips
router.post('/', createUser);
router.get('/:id', getUser);

export default router;
