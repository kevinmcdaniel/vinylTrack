import express from 'express';
import { adminSummary, adminHealth } from '../controller/admin.js';
import { requireActiveUser, requireAdmin } from '../common/authorize.js';

// Admin back office (#90). Summary is cheap (two counts) and feeds the header
// badge; health waits on the mailer, so it is its own route.
export const adminRoute = express.Router();

adminRoute.use(requireActiveUser, requireAdmin);

adminRoute.get('/summary', adminSummary);
adminRoute.get('/health', adminHealth);
