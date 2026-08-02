import express from 'express';
import { listLocations, getLocation, createLocation, updateLocation, deleteLocation } from '../controller/location.js';
import { requireActiveUser } from '../common/authorize.js';
import { requireLocationWriteAccess } from '../common/policy.js';

export const locationRoute = express.Router();

locationRoute.use(requireActiveUser);

locationRoute.get('/', listLocations);
locationRoute.get('/:id', getLocation);
locationRoute.post('/', createLocation);
locationRoute.patch('/:id', requireLocationWriteAccess, updateLocation);
locationRoute.delete('/:id', requireLocationWriteAccess, deleteLocation);
