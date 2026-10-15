import express from 'express';
import { getAdminHealth, getAdminSummary } from '../controller/admin.js';
import { requireActiveUser, requireAdmin } from '../common/authorize.js';

// Admin back office (#90). Two routes, so the header badge (summary) never
// waits on the mailer check (health).
export const adminRoute = express.Router();

adminRoute.use(requireActiveUser, requireAdmin);

adminRoute.get('/summary', getAdminSummary);
adminRoute.get('/health', getAdminHealth);
