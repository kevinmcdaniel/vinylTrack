import type { NextFunction, Request, Response } from 'express';
import { adminHealthService, adminSummaryService } from '../service/admin.js';

export const getAdminSummary = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adminSummaryService();
    res.json({ message: 'Admin summary', data, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const getAdminHealth = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await adminHealthService();
    res.json({ message: 'Workload health', data, status: 200 });
  } catch (error) {
    next(error);
  }
};
