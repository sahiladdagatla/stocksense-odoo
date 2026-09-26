import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/errors.js';
import { adjustStockTx, notifyStockChange } from './stock.service.js';
import type { ProductCreate, ProductQuery, ProductUpdate } from '../schemas/master.schema.js';

export type StockStatus = 'IN_STOCK' | 'LOW' | 'OUT';

export function stockStatus(onHand: number, reorderMin: number): StockStatus {
  if (onHand <= 0) return 'OUT';
  if (onHand <= reorderMin) return 'LOW';
  return 'IN_STOCK';
}

const DAY = 24 * 60 * 60 * 1000;
export const OUTFLOW_WINDOW_DAYS = 14;

/** Total on-hand per product across internal locations (optionally one warehouse only). */
export async function onHandByProduct(productIds: number[], warehouseId?: number) {
  const rows = await prisma.stockQuant.groupBy({
    by: ['productId'],
    where: {
      productId: { in: productIds },
      ...(warehouseId && { location: { warehouseId } }),
    },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity?.toNumber() ?? 0]));
}

/**
 * Stock status depends on computed on-hand, so filtering by it happens after aggregation.
 * The candidate set is only (id, reorderMin) rows, which stays cheap for catalogues of
 * thousands of products; full rows are loaded for the requested page only.
 */
export async function listProducts(q: ProductQuery) {
  const where: Prisma.ProductWhereInput = {};
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { sku: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  const candidates = await prisma.product.findMany({
    where,
    select: { id: true, reorderMin: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
  const onHand = await onHandByProduct(
    candidates.map((c) => c.id),
    q.warehouseId,
  );
  const withStatus = candidates.map((c) => {
    const qty = onHand.get(c.id) ?? 0;
    return { id: c.id, onHand: qty, stockStatus: stockStatus(qty, c.reorderMin.toNumber()) };
  });
  const filtered = q.stockStatus
    ? withStatus.filter((c) => c.stockStatus === q.stockStatus)
    : withStatus;
  const pageRows = filtered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);

  const products = await prisma.product.findMany({
    where: { id: { in: pageRows.map((r) => r.id) } },
    include: { category: { select: { id: true, name: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = pageRows.flatMap((r) => {
    const p = byId.get(r.id);
    return p ? [{ ...p, onHand: r.onHand, stockStatus: r.stockStatus }] : [];
  });
  return { items, total: filtered.length, page: q.page, pageSize: q.pageSize };
}

export async function getProduct(id: number) {
  const p = await prisma.product.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!p) throw notFound('Product not found');
  const onHand = (await onHandByProduct([id])).get(id) ?? 0;
  return { ...p, onHand, stockStatus: stockStatus(onHand, p.reorderMin.toNumber()) };
}

/** Exact SKU lookup (case-insensitive), used by global search and Scan Mode. */
export async function getProductBySku(sku: string) {
  const p = await prisma.product.findFirst({
    where: { sku: { equals: sku.trim(), mode: 'insensitive' } },
    select: { id: true },
  });
  if (!p) throw notFound(`No product with SKU ${sku}`);
  return getProduct(p.id);
}

/** Creates a product; opening stock (if any) is an automatic adjustment in the same transaction. */
export async function createProduct(input: ProductCreate, userId: number) {
  const { initialQty, initialLocationId, ...data } = input;
  if (initialQty && !initialLocationId) {
    throw badRequest('Choose a location for the initial stock', 'LOCATION_REQUIRED');
  }
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data });
    const adj =
      initialQty && initialLocationId
        ? await adjustStockTx(
            tx,
            {
              productId: product.id,
              locationId: initialLocationId,
              countedQty: initialQty,
              reason: 'Opening stock',
            },
            userId,
          )
        : null;
    return { product, operation: adj?.operation ?? null };
  });
  if (result.operation) await notifyStockChange(result.operation, [result.product.id]);
  return result.product;
}

export async function updateProduct(id: number, input: ProductUpdate) {
  await getProduct(id);
  return prisma.product.update({ where: { id }, data: input });
}

export async function deleteProduct(id: number) {
  await getProduct(id);
  // Products with ledger history can't be deleted (FK Restrict -> 409 IN_USE); empty quants can go.
  await prisma.$transaction([
    prisma.stockQuant.deleteMany({ where: { productId: id, quantity: 0 } }),
    prisma.product.delete({ where: { id } }),
  ]);
}

/** Per-location breakdown plus outflow velocity (deliveries + losses over the last 14 days). */
export async function productStock(id: number) {
  const product = await getProduct(id);
  const [quants, outflow] = await Promise.all([
    prisma.stockQuant.findMany({
      where: { productId: id, quantity: { gt: 0 } },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            fullName: true,
            warehouse: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { quantity: 'desc' },
    }),
    prisma.stockMove.aggregate({
      where: {
        productId: id,
        createdAt: { gte: new Date(Date.now() - OUTFLOW_WINDOW_DAYS * DAY) },
        fromLoc: { type: 'INTERNAL' },
        toLoc: { type: { not: 'INTERNAL' } },
      },
      _sum: { quantity: true },
    }),
  ]);
  const avgDailyOut = (outflow._sum.quantity?.toNumber() ?? 0) / OUTFLOW_WINDOW_DAYS;
  return {
    product,
    total: product.onHand,
    locations: quants.map((q) => ({ location: q.location, quantity: q.quantity.toNumber() })),
    avgDailyOut: Math.round(avgDailyOut * 1000) / 1000,
    daysLeft: avgDailyOut > 0 ? Math.floor(product.onHand / avgDailyOut) : null,
  };
}
