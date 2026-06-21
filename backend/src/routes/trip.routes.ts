import { Router } from 'express';
import {
  createTrip,
  getAllTrips,
  getHostedTrips,
  getJoinedTrips,
  requestToJoinTrip,
} from '../controllers/trip.controller';
import { verifyToken, optionalVerifyToken } from '../middlewares/auth.middleware';

const router = Router();

// POST /api/trips          → create a new trip
// GET  /api/trips          → get all upcoming trips (the feed)
// GET  /api/trips/hosted   → trips the user hosts
// GET  /api/trips/joined   → trips the user has joined (APPROVED)
// POST /api/trips/:id/join → request to join a trip
router.post('/', verifyToken, createTrip);
router.get('/', optionalVerifyToken, getAllTrips);
router.get('/hosted', verifyToken, getHostedTrips);
router.get('/joined', verifyToken, getJoinedTrips);
router.post('/:id/join', verifyToken, requestToJoinTrip);

export default router;
