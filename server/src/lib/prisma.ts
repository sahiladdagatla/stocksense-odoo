import { PrismaClient, type Prisma } from '@prisma/client';

export const prisma = new PrismaClient({
  // Tests trigger DB errors on purpose, so stay quiet there.
  log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
});

/** A Prisma client usable both at top level and inside `$transaction`. */
export type Db = PrismaClient | Prisma.TransactionClient;
