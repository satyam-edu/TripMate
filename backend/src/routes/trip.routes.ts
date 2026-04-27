import { Router } from 'express';
import { createTrip, getAllTrips } from '../controllers/trip.controller';

const router = Router();

// POST /api/trips  → create a new trip
// GET  /api/trips  → get all upcoming trips (the feed)
router.post('/', createTrip);
router.get('/', getAllTrips);

export default router;
