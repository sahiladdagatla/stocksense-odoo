import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  // Tests trigger DB errors on purpose, so stay quiet there.
  log: process.env.NODE_ENV === 'test' ? [] : ['warn', 'error'],
});

/** A Prisma client usable both at top level and inside `$transaction`. */
export type Db = PrismaClient | Prisma.TransactionClient;

// Send Decimal quantities as JSON numbers instead of strings. Safe: Decimal(14,3) fits a double exactly
// enough for display, and all arithmetic stays in Decimal on the server.
(Prisma.Decimal.prototype as unknown as { toJSON: () => number }).toJSON = function (
  this: Prisma.Decimal,
) {
  return this.toNumber();
};
