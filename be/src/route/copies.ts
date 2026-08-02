import express from 'express';
import { listCopies, getCopy, createCopy, updateCopy, deleteCopy } from '../controller/copy.js';

export const copyRoute = express.Router();

copyRoute.get('/', listCopies);
copyRoute.get('/:id', getCopy);
copyRoute.post('/', createCopy);
copyRoute.patch('/:id', updateCopy);
copyRoute.delete('/:id', deleteCopy);
