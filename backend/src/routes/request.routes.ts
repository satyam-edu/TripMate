import { Router } from 'express';
import { createRequest, getReceivedRequests, getSentRequests, updateRequestStatus, cancelRequest } from '../controllers/request.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

// All request routes require authentication
// POST  /api/requests           → create a join request (JWT userId)
// GET   /api/requests/received  → pending requests for the user's trips
// GET   /api/requests/sent      → requests sent by the user
// PATCH  /api/requests/:id      → host approves or rejects a request
// DELETE /api/requests/:id      → requester cancels / leaves the trip
router.post('/', verifyToken, createRequest);
router.get('/received', verifyToken, getReceivedRequests);
router.get('/sent', verifyToken, getSentRequests);
router.patch('/:id', verifyToken, updateRequestStatus);
router.delete('/:id', verifyToken, cancelRequest);

export default router;
