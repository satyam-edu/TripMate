import { Router } from 'express';
import { createTrip, getAllTrips, requestToJoinTrip } from '../controllers/trip.controller';
import { verifyToken, optionalVerifyToken } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/trips       → create a new trip
// GET  /api/trips       → get all upcoming trips (the feed)
// POST /api/trips/:id/join → request to join a trip (auth required)
router.post('/', verifyToken, createTrip);
router.get('/', optionalVerifyToken, getAllTrips);
router.post('/:id/join', verifyToken, requestToJoinTrip);

export default router;
