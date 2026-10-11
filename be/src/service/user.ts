import { prisma } from '../database.js';
import { ConflictError, NotFoundError } from '../common/errorHandler.js';

// Never allowAutomation: it isn't readable through the API (#11).
const select = { id: true, email: true, name: true, avatar: true, status: true, isAdmin: true, createdAt: true } as const;

export const USER_STATUSES = ['pending', 'active', 'denied'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const listUsersService = (status: UserStatus | undefined) =>
  prisma.user.findMany({ where: status ? { status } : {}, select, orderBy: { createdAt: 'asc' } });

const requireOther = async (id: string, actingAdminId: string) => {
  if (id === actingAdminId) throw new ConflictError('You cannot change your own status.');
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new NotFoundError(`User id:${id} not found.`);
};

// Approve → active. Optionally links an existing owner row with no account yet
// to this user (#53), in the same transaction: a taken owner aborts both.
export const approveUserService = async (id: string, actingAdminId: string, ownerId?: string) => {
  await requireOther(id, actingAdminId);
  return prisma.$transaction(async (tx) => {
    if (ownerId) {
      const owner = await tx.owner.findUnique({ where: { id: ownerId }, select: { userId: true } });
      if (!owner) throw new NotFoundError(`Owner id:${ownerId} not found.`);
      if (owner.userId && owner.userId !== id) throw new ConflictError('That owner is already linked to another account.');
      await tx.owner.update({ where: { id: ownerId }, data: { userId: id } });
    }
    return tx.user.update({ where: { id }, data: { status: 'active' }, select });
  });
};

export const denyUserService = async (id: string, actingAdminId: string) => {
  await requireOther(id, actingAdminId);
  return prisma.user.update({ where: { id }, data: { status: 'denied' }, select });
};

export const getUserService = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id }, select });
  if (!user) throw new NotFoundError(`User id:${id} not found.`);
  return user;
};

// A denied user may ask again (#11): denied → pending. Pending stays pending.
export const requestAccessService = async (id: string) => {
  const user = await prisma.user.findUnique({ where: { id }, select });
  if (!user) throw new NotFoundError(`User id:${id} not found.`);
  if (user.status === 'active') throw new ConflictError('You already have access.');
  if (user.status === 'pending') return user;
  return prisma.user.update({ where: { id }, data: { status: 'pending' }, select });
};
