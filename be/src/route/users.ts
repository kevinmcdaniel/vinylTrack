import express from 'express';
import { listUsers, approveUser, denyUser } from '../controller/user.js';
import { requireActiveUser, requireAdmin } from '../common/authorize.js';

// Admin-only user management (#73): the pending-requests list and approve/deny.
export const userRoute = express.Router();

userRoute.use(requireActiveUser, requireAdmin);

userRoute.get('/', listUsers);
userRoute.post('/:id/approve', approveUser);
userRoute.post('/:id/deny', denyUser);
