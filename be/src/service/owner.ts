import { prisma } from '../database.js';

// Whoever a copy belongs to (#53). Global and unscoped like `artist`: the same
// family member owns records across collections, so the row is not
// collection-scoped. `user` is never included — an owner row exists precisely
// so attribution does not require an account, and the user row carries an email.

export const listOwnersService = async () => {
  return prisma.owner.findMany({ orderBy: { name: 'asc' } });
};

export const getOwnerService = async (id: string) => {
  return prisma.owner.findUnique({ where: { id } });
};

// `owner.userId` is indexed, not unique (#53) — the one-owner-row-per-account
// rule lives here and in updateOwnerService, nowhere else.
export const userHasOwner = async (userId: string, exceptOwnerId?: string): Promise<boolean> => {
  const existing = await prisma.owner.findFirst({
    where: { userId, ...(exceptOwnerId ? { id: { not: exceptOwnerId } } : {}) },
    select: { id: true },
  });
  return existing !== null;
};

export const ownerForUserService = async (userId: string) => {
  return prisma.owner.findFirst({ where: { userId }, orderBy: { name: 'asc' } });
};

export const createOwnerService = async (data: { name: string; userId?: string }) => {
  return prisma.owner.create({ data });
};

export const updateOwnerService = async (id: string, data: { name?: string; userId?: string }) => {
  return prisma.owner.update({ where: { id }, data });
};

export const deleteOwnerService = async (id: string) => {
  return prisma.owner.delete({ where: { id } });
};
