import { Prisma, type OpStatus, type OpType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { OUTFLOW_WINDOW_DAYS, stockStatus } from './product.service.js';
import type { DashboardQuery } from '../schemas/dashboard.schema.js';

const DAY = 86_400_000;
const OPEN: OpStatus[] = ['WAITING', 'READY'];

/** On-hand per product, optionally restricted to one warehouse and/or category. */
async function onHandRows(q: DashboardQuery) {
  const wh = q.warehouseId ?? null;
  const cat = q.categoryId ?? null;
  const rows = await prisma.$queryRaw<
    {
      id: number;
      name: string;
      sku: string;
      uom: string;
      reorderMin: Prisma.Decimal;
      reorderQty: Prisma.Decimal;
      onHand: Prisma.Decimal;
    }[]
  >`
    SELECT p.id, p.name, p.sku, p.uom, p."reorderMin", p."reorderQty",
           COALESCE(SUM(q."quantity"), 0) AS "onHand"
    FROM "Product" p
    LEFT JOIN "StockQuant" q ON q."productId" = p.id
      AND (${wh}::int IS NULL OR q."locationId" IN (SELECT id FROM "Location" WHERE "warehouseId" = ${wh}::int))
    WHERE ${cat}::int IS NULL OR p."categoryId" = ${cat}::int
    GROUP BY p.id
  `;
  return rows.map((r) => ({
    ...r,
    reorderMin: new Prisma.Decimal(r.reorderMin).toNumber(),
    reorderQty: new Prisma.Decimal(r.reorderQty).toNumber(),
    onHand: new Prisma.Decimal(r.onHand).toNumber(),
  }));
}

function opWhere(q: DashboardQuery, type: OpType): Prisma.OperationWhereInput {
  const and: Prisma.OperationWhereInput[] = [{ type }, { status: { in: OPEN } }];
  if (q.warehouseId) {
    and.push({
      OR: [
        { sourceLoc: { warehouseId: q.warehouseId } },
        { destLoc: { warehouseId: q.warehouseId } },
      ],
    });
  }
  if (q.categoryId) and.push({ lines: { some: { product: { categoryId: q.categoryId } } } });
  return { AND: and };
}

export async function kpis(q: DashboardQuery) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + DAY);

  const [
    rows,
    receipts,
    receiptsToday,
    deliveries,
    deliveriesReady,
    transfers,
    nextTransfer,
    warehouses,
  ] = await Promise.all([
    onHandRows(q),
    prisma.operation.count({ where: opWhere(q, 'RECEIPT') }),
    prisma.operation.count({
      where: { AND: [opWhere(q, 'RECEIPT'), { scheduledDate: { gte: startOfDay, lt: endOfDay } }] },
    }),
    prisma.operation.count({ where: opWhere(q, 'DELIVERY') }),
    prisma.operation.count({ where: { AND: [opWhere(q, 'DELIVERY'), { status: 'READY' }] } }),
    prisma.operation.count({ where: opWhere(q, 'INTERNAL') }),
    prisma.operation.findFirst({
      where: { AND: [opWhere(q, 'INTERNAL'), { scheduledDate: { gte: new Date() } }] },
      orderBy: { scheduledDate: 'asc' },
      select: { scheduledDate: true, reference: true },
    }),
    q.warehouseId ? 1 : prisma.warehouse.count(),
  ]);

  const statuses = rows.map((r) => stockStatus(r.onHand, r.reorderMin));
  return {
    productsInStock: statuses.filter((s) => s !== 'OUT').length,
    lowStock: statuses.filter((s) => s === 'LOW').length,
    outOfStock: statuses.filter((s) => s === 'OUT').length,
    pendingReceipts: receipts,
    receiptsDueToday: receiptsToday,
    pendingDeliveries: deliveries,
    deliveriesReady,
    scheduledTransfers: transfers,
    nextTransfer,
    warehouses,
  };
}

/**
 * Inbound (virtual -> internal) and outbound (internal -> virtual) quantities per day for the last
 * 7 days including today. `tzOffset` is the client's Date#getTimezoneOffset() so days match the user.
 */
export async function movementChart(q: DashboardQuery) {
  const offsetMs = (q.tzOffset ?? new Date().getTimezoneOffset()) * 60_000;
  const localDay = (d: Date) => new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
  const todayLocal = localDay(new Date());
  const start = new Date(new Date(`${todayLocal}T00:00:00Z`).getTime() + offsetMs - 6 * DAY);

  const where: Prisma.StockMoveWhereInput = { createdAt: { gte: start } };
  if (q.categoryId) where.product = { categoryId: q.categoryId };
  const moves = await prisma.stockMove.findMany({
    where,
    select: {
      quantity: true,
      createdAt: true,
      fromLoc: { select: { type: true, warehouseId: true } },
      toLoc: { select: { type: true, warehouseId: true } },
    },
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = localDay(new Date(start.getTime() + i * DAY + 12 * 3600_000));
    return { date, inbound: 0, outbound: 0 };
  });
  const byDate = new Map(days.map((d) => [d.date, d]));
  const inWh = (loc: { type: string; warehouseId: number | null }) =>
    loc.type === 'INTERNAL' && (!q.warehouseId || loc.warehouseId === q.warehouseId);

  for (const m of moves) {
    const bucket = byDate.get(localDay(m.createdAt));
    if (!bucket) continue;
    const qty = m.quantity.toNumber();
    const fromIn = inWh(m.fromLoc);
    const toIn = inWh(m.toLoc);
    if (toIn && !fromIn) bucket.inbound += qty;
    if (fromIn && !toIn) bucket.outbound += qty;
  }
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const series = days.map((d) => ({
    ...d,
    inbound: round(d.inbound),
    outbound: round(d.outbound),
  }));
  return {
    days: series,
    totalInbound: round(series.reduce((a, d) => a + d.inbound, 0)),
    totalOutbound: round(series.reduce((a, d) => a + d.outbound, 0)),
  };
}

/**
 * Products at or below their reorder minimum (or out of stock), with 14-day average outflow,
 * estimated days of stock left, and quantity already incoming on open receipts.
 */
export async function reorderList(q: DashboardQuery) {
  const rows = (await onHandRows(q)).filter(
    (r) => r.onHand <= 0 || (r.reorderMin > 0 && r.onHand <= r.reorderMin),
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [outflow, incoming] = await Promise.all([
    prisma.stockMove.groupBy({
      by: ['productId'],
      where: {
        productId: { in: ids },
        createdAt: { gte: new Date(Date.now() - OUTFLOW_WINDOW_DAYS * DAY) },
        fromLoc: { type: 'INTERNAL', ...(q.warehouseId && { warehouseId: q.warehouseId }) },
        toLoc: { type: { not: 'INTERNAL' } },
      },
      _sum: { quantity: true },
    }),
    prisma.operationLine.groupBy({
      by: ['productId'],
      where: {
        productId: { in: ids },
        operation: {
          type: 'RECEIPT',
          status: { in: ['DRAFT', 'WAITING', 'READY'] },
          ...(q.warehouseId && { destLoc: { warehouseId: q.warehouseId } }),
        },
      },
      _sum: { demandQty: true },
    }),
  ]);
  const out = new Map(outflow.map((o) => [o.productId, o._sum.quantity?.toNumber() ?? 0]));
  const inc = new Map(incoming.map((o) => [o.productId, o._sum.demandQty?.toNumber() ?? 0]));

  return rows
    .map((r) => {
      const avgDailyOut = (out.get(r.id) ?? 0) / OUTFLOW_WINDOW_DAYS;
      return {
        product: { id: r.id, name: r.name, sku: r.sku, uom: r.uom },
        onHand: r.onHand,
        reorderMin: r.reorderMin,
        reorderQty: r.reorderQty,
        stockStatus: stockStatus(r.onHand, r.reorderMin),
        avgDailyOut: Math.round(avgDailyOut * 1000) / 1000,
        daysLeft: r.onHand <= 0 ? 0 : avgDailyOut > 0 ? Math.floor(r.onHand / avgDailyOut) : null,
        incomingQty: inc.get(r.id) ?? 0,
      };
    })
    .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) || a.onHand - b.onHand);
}
