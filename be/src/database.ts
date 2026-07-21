// database.ts - database connection and creation of the prisma client
import { PrismaClient } from './generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DB_VINYLTRACK_URL,
});
export const prisma = new PrismaClient({ adapter });
