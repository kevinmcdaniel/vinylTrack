import express from 'express';
import { listLocations, getLocation, createLocation, updateLocation, deleteLocation } from '../controller/location.js';

export const locationRoute = express.Router();

locationRoute.get('/', listLocations);
locationRoute.get('/:id', getLocation);
locationRoute.post('/', createLocation);
locationRoute.patch('/:id', updateLocation);
locationRoute.delete('/:id', deleteLocation);
