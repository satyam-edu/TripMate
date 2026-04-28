import { Router } from 'express';
import { googleLogin } from '../controllers/auth.controller';

const router = Router();

// POST /api/auth/google  →  verify Google ID token, upsert user, return JWT
router.post('/google', googleLogin);

export default router;
