import express from 'express';
import { listOwners, getOwner, createOwner, updateOwner, deleteOwner } from '../controller/owner.js';
import { requireActiveUser, requireAdmin } from '../common/authorize.js';

export const ownerRoute = express.Router();

ownerRoute.use(requireActiveUser);

ownerRoute.get('/', listOwners);
ownerRoute.get('/:id', getOwner);
ownerRoute.post('/', createOwner);
ownerRoute.patch('/:id', updateOwner);
// Same rule as artist (#26): deleting an owner strips attribution from copies
// other family members depend on, so it is admin-only.
ownerRoute.delete('/:id', requireAdmin, deleteOwner);
