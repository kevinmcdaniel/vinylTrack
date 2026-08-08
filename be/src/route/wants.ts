import express from 'express';
import {
  listWantItems,
  createWantItem,
  updateWantItem,
  deleteWantItem,
  markWantItemFound,
} from '../controller/want.js';

export const wantRoute = express.Router();

wantRoute.get('/', listWantItems);
wantRoute.post('/', createWantItem);
wantRoute.patch('/:id', updateWantItem);
wantRoute.delete('/:id', deleteWantItem);
wantRoute.post('/:id/found', markWantItemFound);
