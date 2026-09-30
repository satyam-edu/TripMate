import { Router } from 'express';
import {
  createTrip,
  getAllTrips,
  getHostedTrips,
  getJoinedTrips,
  updateTrip,
  deleteTrip,
} from '../controllers/trip.controller';
import { verifyToken, optionalVerifyToken } from '../middlewares/auth.middleware';

const router = Router();

// POST   /api/trips          → create a new trip
// GET    /api/trips          → get all upcoming trips (the feed)
// GET    /api/trips/hosted   → trips the user hosts
// GET    /api/trips/joined   → trips the user has joined (APPROVED)
// PATCH  /api/trips/:id      → host edits their trip
// DELETE /api/trips/:id      → host deletes their trip
// (Join requests live under /api/requests.)
router.post('/', verifyToken, createTrip);
router.get('/', optionalVerifyToken, getAllTrips);
router.get('/hosted', verifyToken, getHostedTrips);
router.get('/joined', verifyToken, getJoinedTrips);
router.patch('/:id', verifyToken, updateTrip);
router.delete('/:id', verifyToken, deleteTrip);

export default router;
