/** Reading and editing operation documents (the lifecycle lives in operation.service.ts). */
import { Prisma } from '@prisma/client';
import { likeSafe } from '../lib/search.js';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';
import { emitOperationChanged } from '../lib/events.js';
import { assertProductsExist, resolveLocations } from './operation.service.js';
import type { OperationQuery, OperationUpdate } from '../schemas/operation.schema.js';

const locSelect = {
  select: { id: true, name: true, fullName: true, type: true, warehouseId: true },
} as const;

function buildWhere(q: OperationQuery): Prisma.OperationWhereInput {
  const and: Prisma.OperationWhereInput[] = [];
  if (q.type) and.push({ type: q.type });
  if (q.status) and.push({ status: { in: q.status } });
  if (q.warehouseId) {
    and.push({
      OR: [
        { sourceLoc: { warehouseId: q.warehouseId } },
        { destLoc: { warehouseId: q.warehouseId } },
      ],
    });
  }
  if (q.categoryId) and.push({ lines: { some: { product: { categoryId: q.categoryId } } } });
  if (q.search) {
    and.push({
      OR: [
        { reference: { contains: likeSafe(q.search), mode: 'insensitive' } },
        { partner: { contains: likeSafe(q.search), mode: 'insensitive' } },
      ],
    });
  }
  return { AND: and };
}

/** Count per status for the same filters as the list (status filter ignored). */
export async function operationCounts(q: OperationQuery) {
  const rows = await prisma.operation.groupBy({
    by: ['status'],
    where: buildWhere({ ...q, status: undefined }),
    _count: true,
  });
  const counts = { DRAFT: 0, WAITING: 0, READY: 0, DONE: 0, CANCELED: 0 };
  for (const r of rows) counts[r.status] = r._count;
  return { ...counts, total: rows.reduce((a, r) => a + r._count, 0) };
}

export async function listOperations(q: OperationQuery) {
  const where = buildWhere(q);
  const [total, items] = await Promise.all([
    prisma.operation.count({ where }),
    prisma.operation.findMany({
      where,
      include: {
        sourceLoc: locSelect,
        destLoc: locSelect,
        createdBy: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: [{ scheduledDate: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

/** Full document, with the quantity currently available at the source for each line. */
export async function getOperation(id: number) {
  const op = await prisma.operation.findUnique({
    where: { id },
    include: {
      sourceLoc: locSelect,
      destLoc: locSelect,
      createdBy: { select: { id: true, name: true, role: true } },
      backorderOf: { select: { id: true, reference: true, status: true } },
      backorders: { select: { id: true, reference: true, status: true }, orderBy: { id: 'asc' } },
      lines: {
        include: { product: { select: { id: true, name: true, sku: true, uom: true } } },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!op) throw notFound('Operation not found');
  const internalSource = op.sourceLoc.type === 'INTERNAL';
  const available = new Map<number, number>();
  if (internalSource) {
    const quants = await prisma.stockQuant.findMany({
      where: { locationId: op.sourceLocId, productId: { in: op.lines.map((l) => l.productId) } },
    });
    for (const q of quants) available.set(q.productId, q.quantity.toNumber());
  }
  return {
    ...op,
    lines: op.lines.map((l) => ({
      ...l,
      availableQty: internalSource ? (available.get(l.productId) ?? 0) : null,
    })),
  };
}

/**
 * DRAFT documents are fully editable. READY/WAITING documents only accept done quantities for
 * their existing lines (what was actually picked or received); everything else is locked.
 */
export async function updateOperation(id: number, input: OperationUpdate) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Operation" WHERE id = ${id} FOR UPDATE`;
    const op = await tx.operation.findUnique({ where: { id }, include: { lines: true } });
    if (!op) throw notFound('Operation not found');
    const locked = () => conflict('Only draft operations can be edited', 'NOT_EDITABLE');

    if (op.status === 'READY' || op.status === 'WAITING') {
      const lines = input.lines;
      const onlyDoneQty =
        lines !== undefined &&
        Object.keys(input).every((k) => k === 'lines') &&
        lines.length === op.lines.length &&
        lines.every(
          (l) =>
            op.lines.find((x) => x.productId === l.productId)?.demandQty.toNumber() === l.demandQty,
        );
      if (!onlyDoneQty) throw locked();
      for (const l of lines) {
        await tx.operationLine.update({
          where: { operationId_productId: { operationId: id, productId: l.productId } },
          data: { doneQty: l.doneQty ?? 0 },
        });
      }
      return;
    }
    if (op.status !== 'DRAFT' || op.type === 'ADJUSTMENT') throw locked();

    let locs: { sourceLocId: number; destLocId: number } | undefined;
    if (input.sourceLocId !== undefined || input.destLocId !== undefined) {
      const r = await resolveLocations(
        tx,
        op.type,
        input.sourceLocId ?? op.sourceLocId,
        input.destLocId ?? op.destLocId,
      );
      locs = { sourceLocId: r.source.id, destLocId: r.dest.id };
    }
    if (input.lines) {
      await assertProductsExist(
        tx,
        input.lines.map((l) => l.productId),
      );
      await tx.operationLine.deleteMany({ where: { operationId: id } });
      await tx.operationLine.createMany({
        data: input.lines.map((l) => ({
          operationId: id,
          productId: l.productId,
          demandQty: new Prisma.Decimal(l.demandQty),
          doneQty: new Prisma.Decimal(l.doneQty ?? 0),
        })),
      });
    }
    const text = (v: string | null | undefined) =>
      v === undefined ? undefined : v?.trim() || null;
    await tx.operation.update({
      where: { id },
      data: {
        ...locs,
        partner: text(input.partner),
        notes: text(input.notes),
        scheduledDate: input.scheduledDate,
      },
    });
  });
  const updated = await getOperation(id);
  emitOperationChanged(updated);
  return updated;
}
