import { Router } from 'express';
import { getImage } from '../controllers/image.controller';

const router = Router();

// GET /api/images/:id → an uploaded profile photo / cover (public, cached for a year)
router.get('/:id', getImage);

export default router;
