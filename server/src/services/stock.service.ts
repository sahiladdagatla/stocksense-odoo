/**
 * The stock engine. Every inventory change is a StockMove between two locations; StockQuant is a
 * cache of on-hand stock for INTERNAL locations, written only here and only in the same transaction
 * as the moves. Virtual locations (VENDOR / CUSTOMER / LOSS) never hold quants and never run out.
 */
import { Prisma, type Location, type Operation, type OperationLine } from '@prisma/client';
import { prisma, type Db } from '../lib/prisma.js';
import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { emitOperationChanged, emitStockUpdated } from '../lib/events.js';
import { nextOperationReference } from '../lib/sequence.js';
import { virtualLocation } from './location.service.js';

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

type LoadedOp = Operation & {
  sourceLoc: Location;
  destLoc: Location;
  lines: (OperationLine & { product: { id: number; name: string; sku: string } })[];
};

/** Options used by the seed to backdate history. Not exposed through the API. */
export type EngineOptions = {
  at?: Date;
  /** Partial validation: create a follow-up document for the remaining quantity (default true). */
  createBackorder?: boolean;
};

const lineQty = (l: OperationLine): Decimal => (l.doneQty.gt(0) ? l.doneQty : l.demandQty);

async function loadOperation(db: Db, id: number): Promise<LoadedOp> {
  const op = await db.operation.findUnique({
    where: { id },
    include: {
      sourceLoc: true,
      destLoc: true,
      lines: {
        include: { product: { select: { id: true, name: true, sku: true } } },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!op) throw notFound('Operation not found');
  return op;
}

/**
 * Makes sure a quant row exists for every (location, product) pair, then locks them all with
 * SELECT ... FOR UPDATE in one deterministic order (location, product) so that concurrent
 * validations touching the same rows serialise instead of deadlocking.
 */
async function lockQuants(tx: Tx, pairs: { locationId: number; productId: number }[]) {
  const quantities = new Map<string, Decimal>();
  if (pairs.length === 0) return quantities;
  const values = Prisma.join(
    pairs.map((p) => Prisma.sql`(${p.productId}::int, ${p.locationId}::int)`),
  );
  await tx.$executeRaw`
    INSERT INTO "StockQuant" ("productId", "locationId", "quantity", "updatedAt")
    SELECT v.p, v.l, 0, now() FROM (VALUES ${values}) AS v(p, l)
    ON CONFLICT ("productId", "locationId") DO NOTHING
  `;
  const rows = await tx.$queryRaw<{ productId: number; locationId: number; quantity: Decimal }[]>`
    SELECT "productId", "locationId", "quantity" FROM "StockQuant"
    WHERE ("productId", "locationId") IN (${values})
    ORDER BY "locationId", "productId"
    FOR UPDATE
  `;
  for (const r of rows) quantities.set(`${r.locationId}:${r.productId}`, new D(r.quantity));
  return quantities;
}

/**
 * Validates an operation inside an existing transaction: checks stock, moves quants, writes the
 * ledger and marks the operation DONE. Throws (rolling everything back) on any problem.
 */
export async function validateOperationTx(
  tx: Tx,
  operationId: number,
  userId: number,
  opts: EngineOptions = {},
) {
  // Row lock on the operation: two concurrent validations of the same document serialise here.
  await tx.$queryRaw`SELECT id FROM "Operation" WHERE id = ${operationId} FOR UPDATE`;
  const op = await loadOperation(tx, operationId);

  if (op.status === 'DONE') throw conflict(`${op.reference} is already validated`, 'ALREADY_DONE');
  if (op.status === 'CANCELED') throw conflict(`${op.reference} is canceled`, 'OPERATION_CANCELED');
  if (op.status === 'DRAFT')
    throw conflict(`Confirm ${op.reference} before validating it`, 'NOT_CONFIRMED');
  if (op.lines.length === 0) throw unprocessable('The operation has no product lines', 'NO_LINES');

  const src = op.sourceLoc;
  const dst = op.destLoc;
  const pairs = [
    ...(src.type === 'INTERNAL'
      ? op.lines.map((l) => ({ locationId: src.id, productId: l.productId }))
      : []),
    ...(dst.type === 'INTERNAL'
      ? op.lines.map((l) => ({ locationId: dst.id, productId: l.productId }))
      : []),
  ];
  const locked = await lockQuants(tx, pairs);

  if (src.type === 'INTERNAL') {
    for (const line of op.lines) {
      const available = locked.get(`${src.id}:${line.productId}`) ?? new D(0);
      const needed = lineQty(line);
      if (available.lt(needed)) {
        throw unprocessable(
          `Insufficient stock for ${line.product.name} (${line.product.sku}) at ${src.fullName}: ` +
            `${available.toString()} available, ${needed.toString()} required`,
          'INSUFFICIENT_STOCK',
        );
      }
    }
  }

  const at = opts.at ?? new Date();
  for (const line of op.lines) {
    const q = lineQty(line);
    if (src.type === 'INTERNAL') {
      await tx.stockQuant.update({
        where: { productId_locationId: { productId: line.productId, locationId: src.id } },
        data: { quantity: { decrement: q } },
      });
    }
    if (dst.type === 'INTERNAL') {
      await tx.stockQuant.update({
        where: { productId_locationId: { productId: line.productId, locationId: dst.id } },
        data: { quantity: { increment: q } },
      });
    }
    await tx.operationLine.update({ where: { id: line.id }, data: { doneQty: q } });
  }
  await tx.stockMove.createMany({
    data: op.lines.map((line) => ({
      productId: line.productId,
      fromLocId: src.id,
      toLocId: dst.id,
      quantity: lineQty(line),
      operationId: op.id,
      userId,
      createdAt: at,
    })),
  });
  const done = await tx.operation.update({
    where: { id: op.id },
    data: { status: 'DONE', validatedAt: at },
  });

  // Lines explicitly validated below their demand leave a remainder. Unless told otherwise, book
  // that remainder as a backorder: same partner, route and type, linked back to this document.
  const remaining = op.lines
    .filter((l) => l.doneQty.gt(0) && l.doneQty.lt(l.demandQty))
    .map((l) => ({ productId: l.productId, demandQty: l.demandQty.minus(l.doneQty) }));
  if (remaining.length > 0 && opts.createBackorder !== false && op.type !== 'ADJUSTMENT') {
    const internalSide = src.type === 'INTERNAL' ? src : dst;
    // Internal locations always belong to a warehouse (enforced by a CHECK constraint).
    if (!internalSide.warehouseId) throw new Error(`Location ${internalSide.id} has no warehouse`);
    const warehouse = await tx.warehouse.findUniqueOrThrow({
      where: { id: internalSide.warehouseId },
      select: { code: true },
    });
    const backorder = await tx.operation.create({
      data: {
        reference: await nextOperationReference(tx, warehouse.code, op.type),
        type: op.type,
        status: 'DRAFT',
        partner: op.partner,
        sourceLocId: src.id,
        destLocId: dst.id,
        scheduledDate: op.scheduledDate,
        createdById: userId,
        createdAt: at,
        notes: `Backorder of ${op.reference}`,
        backorderOfId: op.id,
        lines: { create: remaining },
      },
    });
    // Already confirmed in spirit: ready if stock allows, otherwise waiting for it.
    const status =
      op.type === 'RECEIPT' || (await isAvailable(tx, backorder.id)) ? 'READY' : 'WAITING';
    await tx.operation.update({ where: { id: backorder.id }, data: { status } });
  }
  return done;
}

/** Runs after a stock-changing transaction has committed. */
async function afterCommit(op: Operation, productIds: number[]) {
  // Anything that added stock to an internal location may unblock WAITING documents. Promote them
  // first, so clients refreshing on the event below already see the new statuses.
  if (op.type !== 'DELIVERY') await recheckWaiting();
  emitStockUpdated({ operationId: op.id, reference: op.reference, type: op.type, productIds });
}

/** THE single entry point that validates any operation type. */
export async function validateOperation(
  operationId: number,
  userId: number,
  opts: EngineOptions = {},
) {
  const op = await prisma.$transaction((tx) => validateOperationTx(tx, operationId, userId, opts));
  const backorders = await prisma.operation.findMany({
    where: { backorderOfId: operationId },
    select: { id: true, type: true, status: true },
  });
  backorders.forEach((b) => emitOperationChanged(b));
  const lines = await prisma.operationLine.findMany({
    where: { operationId },
    select: { productId: true },
  });
  await afterCommit(
    op,
    lines.map((l) => l.productId),
  );
  return op;
}

/** True when the source location holds enough stock for every line (always true for virtual sources). */
export async function isAvailable(db: Db, operationId: number) {
  const op = await loadOperation(db, operationId);
  if (op.sourceLoc.type !== 'INTERNAL') return true;
  const quants = await db.stockQuant.findMany({
    where: { locationId: op.sourceLocId, productId: { in: op.lines.map((l) => l.productId) } },
  });
  const onHand = new Map(quants.map((q) => [q.productId, q.quantity]));
  return op.lines.every((l) => (onHand.get(l.productId) ?? new D(0)).gte(lineQty(l)));
}

/** Moves WAITING deliveries/transfers to READY when their stock is now available. Returns promoted ids. */
export async function recheckWaiting() {
  const waiting = await prisma.operation.findMany({
    where: { status: 'WAITING' },
    select: { id: true, type: true },
    orderBy: { scheduledDate: 'asc' },
  });
  const promoted: number[] = [];
  for (const op of waiting) {
    const { id } = op;
    if (await isAvailable(prisma, id)) {
      const { count } = await prisma.operation.updateMany({
        where: { id, status: 'WAITING' },
        data: { status: 'READY' },
      });
      if (count) {
        promoted.push(id);
        emitOperationChanged({ id, type: op.type, status: 'READY' });
      }
    }
  }
  return promoted;
}

/**
 * Sets the counted quantity for a product at an internal location. The difference is booked as an
 * ADJUSTMENT operation against the virtual Inventory Loss location and validated in the same
 * transaction. Returns null operation when the count matches the records.
 */
export async function adjustStockTx(
  tx: Tx,
  input: { productId: number; locationId: number; countedQty: number; reason?: string | null },
  userId: number,
  opts: EngineOptions = {},
) {
  const [product, location] = await Promise.all([
    tx.product.findUnique({ where: { id: input.productId } }),
    tx.location.findUnique({ where: { id: input.locationId }, include: { warehouse: true } }),
  ]);
  if (!product) throw notFound('Product not found');
  if (!location || location.type !== 'INTERNAL' || !location.warehouse) {
    throw unprocessable('Adjustments must target an internal location', 'INVALID_LOCATION');
  }

  const locked = await lockQuants(tx, [{ locationId: location.id, productId: product.id }]);
  const previous = locked.get(`${location.id}:${product.id}`) ?? new D(0);
  const counted = new D(input.countedQty);
  const diff = counted.minus(previous);
  const result = {
    previousQty: previous.toNumber(),
    countedQty: counted.toNumber(),
    difference: diff.toNumber(),
  };
  if (diff.isZero()) return { ...result, operation: null };

  const loss = await virtualLocation(tx, 'LOSS');
  const at = opts.at ?? new Date();
  const op = await tx.operation.create({
    data: {
      reference: await nextOperationReference(tx, location.warehouse.code, 'ADJUSTMENT'),
      type: 'ADJUSTMENT',
      status: 'READY',
      partner: null,
      sourceLocId: diff.isNegative() ? location.id : loss.id,
      destLocId: diff.isNegative() ? loss.id : location.id,
      scheduledDate: at,
      createdAt: at,
      createdById: userId,
      notes: input.reason?.trim() || null,
      lines: { create: { productId: product.id, demandQty: diff.abs() } },
    },
  });
  const done = await validateOperationTx(tx, op.id, userId, opts);
  return { ...result, operation: done };
}

export async function adjustStock(
  input: Parameters<typeof adjustStockTx>[1],
  userId: number,
  opts: EngineOptions = {},
) {
  const res = await prisma.$transaction((tx) => adjustStockTx(tx, input, userId, opts));
  if (res.operation) await afterCommit(res.operation, [input.productId]);
  return res;
}

/** Notifies listeners about a stock change committed by a caller-owned transaction. */
export const notifyStockChange = afterCommit;

/**
 * Recomputes every internal (product, location) balance from the raw ledger and compares it with
 * StockQuant. An empty discrepancy list means the cache and the ledger agree exactly.
 */
export async function integrityCheck() {
  const discrepancies = await prisma.$queryRaw<
    { productId: number; locationId: number; ledgerQty: Decimal; quantQty: Decimal }[]
  >`
    WITH flows AS (
      SELECT "productId", "toLocId" AS loc, "quantity" AS q FROM "StockMove"
      UNION ALL
      SELECT "productId", "fromLocId" AS loc, -"quantity" AS q FROM "StockMove"
    ), ledger AS (
      SELECT f."productId", f.loc, SUM(f.q) AS qty
      FROM flows f JOIN "Location" l ON l.id = f.loc AND l.type = 'INTERNAL'
      GROUP BY f."productId", f.loc
    )
    SELECT COALESCE(l."productId", s."productId") AS "productId",
           COALESCE(l.loc, s."locationId")        AS "locationId",
           COALESCE(l.qty, 0)                      AS "ledgerQty",
           COALESCE(s."quantity", 0)               AS "quantQty"
    FROM ledger l
    FULL OUTER JOIN "StockQuant" s ON s."productId" = l."productId" AND s."locationId" = l.loc
    WHERE COALESCE(l.qty, 0) <> COALESCE(s."quantity", 0)
    ORDER BY 1, 2
  `;
  const [movesChecked, quantsChecked] = await Promise.all([
    prisma.stockMove.count(),
    prisma.stockQuant.count(),
  ]);

  const products = await prisma.product.findMany({
    where: { id: { in: discrepancies.map((d) => d.productId) } },
    select: { id: true, name: true, sku: true },
  });
  const locations = await prisma.location.findMany({
    where: { id: { in: discrepancies.map((d) => d.locationId) } },
    select: { id: true, fullName: true },
  });
  const pName = new Map(products.map((p) => [p.id, p]));
  const lName = new Map(locations.map((l) => [l.id, l.fullName]));

  return {
    balanced: discrepancies.length === 0,
    movesChecked,
    quantsChecked,
    checkedAt: new Date(),
    discrepancies: discrepancies.map((d) => {
      const ledgerQty = new D(d.ledgerQty);
      const quantQty = new D(d.quantQty);
      return {
        product: pName.get(d.productId) ?? { id: d.productId, name: '?', sku: '?' },
        location: { id: d.locationId, fullName: lName.get(d.locationId) ?? '?' },
        ledgerQty: ledgerQty.toNumber(),
        quantQty: quantQty.toNumber(),
        difference: quantQty.minus(ledgerQty).toNumber(),
      };
    }),
  };
}
