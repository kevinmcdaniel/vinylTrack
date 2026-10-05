// database.ts - database connection and creation of the prisma client
import { PrismaClient } from './generated/client/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { getConfig } from './config.js';

const adapter = new PrismaPg({
  connectionString: getConfig().databaseUrl,
});
export const prisma = new PrismaClient({ adapter });
