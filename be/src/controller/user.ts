import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../common/errorHandler.js';
import { assertOnlyFields, routeParam } from '../common/utils.js';
import {
  USER_STATUSES,
  type UserStatus,
  listUsersService,
  approveUserService,
  denyUserService,
  requestAccessService,
  getUserService,
} from '../service/user.js';

const validation = (m: string) => new ValidationError(m);

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status;
    if (status !== undefined && !USER_STATUSES.includes(status as UserStatus)) {
      throw new ValidationError(`status must be one of ${USER_STATUSES.join(', ')}.`);
    }
    const records = await listUsersService(status as UserStatus | undefined);
    res.json({ message: 'List of users', data: records, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const approveUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertOnlyFields(req.body, ['ownerId'], validation);
    const ownerId = req.body?.ownerId;
    if (ownerId !== undefined && typeof ownerId !== 'string') throw new ValidationError('ownerId must be a string.');
    const record = await approveUserService(routeParam(req.params.id), req.user!.id, ownerId);
    res.json({ message: 'User approved', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const denyUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertOnlyFields(req.body, [], validation);
    const record = await denyUserService(routeParam(req.params.id), req.user!.id);
    res.json({ message: 'User denied', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};

// The caller, whatever their status: the FE uses it to pick the right screen
// (app, waiting for approval, denied) and to know whether to show admin links.
export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await getUserService(req.user!.id);
    res.json({ message: 'Current user', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const requestAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertOnlyFields(req.body, ['turnstileToken'], validation);
    const record = await requestAccessService(req.user!.id);
    res.json({ message: 'Access requested', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};
