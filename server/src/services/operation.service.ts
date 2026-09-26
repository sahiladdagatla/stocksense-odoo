import type { Location, OpType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound, unprocessable } from '../lib/errors.js';
import { nextOperationReference } from '../lib/sequence.js';
import { virtualLocation } from './location.service.js';
import { isAvailable, type EngineOptions } from './stock.service.js';
import type { OperationCreate } from '../schemas/operation.schema.js';

type Tx = Prisma.TransactionClient;

async function internal(tx: Tx, id: number | undefined, label: string) {
  if (!id) throw badRequest(`${label} location is required`, 'LOCATION_REQUIRED');
  const loc = await tx.location.findUnique({ where: { id }, include: { warehouse: true } });
  if (!loc) throw notFound(`${label} location not found`);
  if (loc.type !== 'INTERNAL' || !loc.warehouse) {
    throw badRequest(`${label} must be an internal location`, 'INVALID_LOCATION');
  }
  return loc as Location & { warehouse: NonNullable<typeof loc.warehouse> };
}

/**
 * Resolves source/destination for a document type. The outside world is always the matching virtual
 * location, so clients never pick Vendors/Customers themselves. The reference uses the warehouse of
 * the internal side (the source side for transfers).
 */
export async function resolveLocations(
  tx: Tx,
  type: Exclude<OpType, 'ADJUSTMENT'>,
  sourceLocId?: number,
  destLocId?: number,
) {
  if (type === 'RECEIPT') {
    const dest = await internal(tx, destLocId, 'Destination');
    return {
      source: await virtualLocation(tx, 'VENDOR'),
      dest,
      warehouseCode: dest.warehouse.code,
    };
  }
  if (type === 'DELIVERY') {
    const source = await internal(tx, sourceLocId, 'Source');
    return {
      source,
      dest: await virtualLocation(tx, 'CUSTOMER'),
      warehouseCode: source.warehouse.code,
    };
  }
  const source = await internal(tx, sourceLocId, 'Source');
  const dest = await internal(tx, destLocId, 'Destination');
  if (source.id === dest.id)
    throw badRequest('Source and destination must differ', 'SAME_LOCATION');
  return { source, dest, warehouseCode: source.warehouse.code };
}

async function assertProductsExist(tx: Tx, ids: number[]) {
  const found = await tx.product.count({ where: { id: { in: ids } } });
  if (found !== new Set(ids).size) throw notFound('One or more products do not exist');
}

export async function createOperationTx(
  tx: Tx,
  input: OperationCreate,
  userId: number,
  opts: EngineOptions = {},
) {
  const { source, dest, warehouseCode } = await resolveLocations(
    tx,
    input.type,
    input.sourceLocId,
    input.destLocId,
  );
  await assertProductsExist(
    tx,
    input.lines.map((l) => l.productId),
  );
  const at = opts.at ?? new Date();
  return tx.operation.create({
    data: {
      reference: await nextOperationReference(tx, warehouseCode, input.type),
      type: input.type,
      status: 'DRAFT',
      partner: input.partner?.trim() || null,
      sourceLocId: source.id,
      destLocId: dest.id,
      scheduledDate: input.scheduledDate ?? at,
      notes: input.notes?.trim() || null,
      createdById: userId,
      createdAt: at,
      lines: {
        create: input.lines.map((l) => ({ productId: l.productId, demandQty: l.demandQty })),
      },
    },
  });
}

export const createOperation = (input: OperationCreate, userId: number, opts: EngineOptions = {}) =>
  prisma.$transaction((tx) => createOperationTx(tx, input, userId, opts));

/**
 * DRAFT -> READY for receipts. Deliveries and transfers become READY when the source holds enough
 * stock for every line, otherwise WAITING (promoted automatically once stock arrives).
 */
export async function confirmOperation(id: number) {
  const op = await prisma.operation.findUnique({
    where: { id },
    include: { _count: { select: { lines: true } } },
  });
  if (!op) throw notFound('Operation not found');
  if (op.status !== 'DRAFT') throw conflict(`Only draft operations can be confirmed`, 'NOT_DRAFT');
  if (op._count.lines === 0) throw unprocessable('Add at least one product', 'NO_LINES');

  const status = op.type === 'RECEIPT' || (await isAvailable(prisma, id)) ? 'READY' : 'WAITING';
  // Conditional update guards against a concurrent confirm/cancel.
  const { count } = await prisma.operation.updateMany({
    where: { id, status: 'DRAFT' },
    data: { status },
  });
  if (!count) throw conflict('The operation was changed by someone else', 'STALE');
  return prisma.operation.findUniqueOrThrow({ where: { id } });
}

export async function cancelOperation(id: number) {
  const op = await prisma.operation.findUnique({ where: { id } });
  if (!op) throw notFound('Operation not found');
  if (op.status === 'DONE')
    throw conflict('Validated operations cannot be canceled', 'ALREADY_DONE');
  if (op.status === 'CANCELED')
    throw conflict('The operation is already canceled', 'OPERATION_CANCELED');
  const { count } = await prisma.operation.updateMany({
    where: { id, status: { notIn: ['DONE', 'CANCELED'] } },
    data: { status: 'CANCELED' },
  });
  if (!count) throw conflict('The operation was changed by someone else', 'STALE');
  return prisma.operation.findUniqueOrThrow({ where: { id } });
}
