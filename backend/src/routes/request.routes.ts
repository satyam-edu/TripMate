import { Router } from 'express';
import { sendRequest, updateRequestStatus } from '../controllers/request.controller';

const router = Router();

// POST  /api/requests      → send a join request (creates PENDING)
// PATCH /api/requests/:id  → host accepts or declines a request
router.post('/', sendRequest);
router.patch('/:id', updateRequestStatus);

export default router;
