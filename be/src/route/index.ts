import { Router } from 'express';
import { healthRoute } from './health.js';
import { collectionRoute } from './collections.js';
import { artistRoute } from './artists.js';
import { albumRoute } from './albums.js';
import { locationRoute } from './locations.js';
import { ownerRoute } from './owners.js';
import { copyRoute } from './copies.js';
import { wantRoute } from './wants.js';

export const indexRoute = Router();

indexRoute.use('/health', healthRoute);
indexRoute.use('/collection', collectionRoute);
indexRoute.use('/artist', artistRoute);
indexRoute.use('/album', albumRoute);
indexRoute.use('/location', locationRoute);
indexRoute.use('/owner', ownerRoute);
indexRoute.use('/copy', copyRoute);
indexRoute.use('/want', wantRoute);
