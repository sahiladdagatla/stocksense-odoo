import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { MoveQuery } from '../schemas/operation.schema.js';

function whereFor(q: MoveQuery): Prisma.StockMoveWhereInput {
  const and: Prisma.StockMoveWhereInput[] = [];
  if (q.productId) and.push({ productId: q.productId });
  if (q.userId) and.push({ userId: q.userId });
  if (q.type) and.push({ operation: { type: q.type } });
  if (q.locationId) and.push({ OR: [{ fromLocId: q.locationId }, { toLocId: q.locationId }] });
  if (q.from || q.to) and.push({ createdAt: { gte: q.from, lte: q.to } });
  if (q.search) {
    and.push({
      OR: [
        { operation: { reference: { contains: q.search, mode: 'insensitive' } } },
        { product: { name: { contains: q.search, mode: 'insensitive' } } },
        { product: { sku: { contains: q.search, mode: 'insensitive' } } },
      ],
    });
  }
  return { AND: and };
}

const include = {
  product: { select: { id: true, name: true, sku: true, uom: true } },
  fromLoc: { select: { id: true, fullName: true, type: true } },
  toLoc: { select: { id: true, fullName: true, type: true } },
  operation: { select: { id: true, reference: true, type: true, partner: true, notes: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.StockMoveInclude;

const order: Prisma.StockMoveOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

export async function listMoves(q: MoveQuery) {
  const where = whereFor(q);
  const [total, items] = await Promise.all([
    prisma.stockMove.count({ where }),
    prisma.stockMove.findMany({
      where,
      include,
      orderBy: order,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? '' : String(v);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Ledger export (max 10,000 rows) using the same filters as the list. */
export async function exportMovesCsv(q: MoveQuery) {
  const rows = await prisma.stockMove.findMany({
    where: whereFor(q),
    include,
    orderBy: order,
    take: 10_000,
  });
  const header = [
    'Timestamp',
    'Reference',
    'Type',
    'SKU',
    'Product',
    'Quantity',
    'UoM',
    'From',
    'To',
    'User',
  ];
  const lines = rows.map((m) =>
    [
      m.createdAt.toISOString(),
      m.operation?.reference,
      m.operation?.type,
      m.product.sku,
      m.product.name,
      m.quantity.toString(),
      m.product.uom,
      m.fromLoc.fullName,
      m.toLoc.fullName,
      m.user.name,
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.map(csvCell).join(','), ...lines].join('\r\n');
}
