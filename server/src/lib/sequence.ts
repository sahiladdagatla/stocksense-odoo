import type { OpType, Prisma } from '@prisma/client';

export const OP_PREFIX: Record<OpType, string> = {
  RECEIPT: 'IN',
  DELIVERY: 'OUT',
  INTERNAL: 'INT',
  ADJUSTMENT: 'ADJ',
};

/**
 * Atomically claims the next number for `key` and returns it.
 * The upsert takes a row lock, so concurrent transactions serialise on the same key and
 * never hand out duplicates. A rolled-back transaction releases its number.
 * Must be called inside a transaction together with the insert that uses the number.
 */
export async function nextSequenceValue(tx: Prisma.TransactionClient, key: string) {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Sequence" ("key", "next") VALUES (${key}, 2)
    ON CONFLICT ("key") DO UPDATE SET "next" = "Sequence"."next" + 1
    RETURNING "next" - 1 AS "value"
  `;
  const value = rows[0]?.value;
  if (value === undefined) throw new Error(`Sequence ${key} did not return a value`);
  return value;
}

/** Builds a document reference such as `WH1/IN/0001`. */
export async function nextOperationReference(
  tx: Prisma.TransactionClient,
  warehouseCode: string,
  type: OpType,
) {
  const key = `${warehouseCode}/${OP_PREFIX[type]}`;
  const n = await nextSequenceValue(tx, key);
  return `${key}/${String(n).padStart(4, '0')}`;
}
