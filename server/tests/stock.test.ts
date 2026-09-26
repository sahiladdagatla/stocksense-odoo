import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { events, type StockUpdatedEvent } from '../src/lib/events.js';
import { adjustStock, integrityCheck, validateOperation } from '../src/services/stock.service.js';
import {
  cancelOperation,
  confirmOperation,
  createOperation,
} from '../src/services/operation.service.js';
import { createProduct } from '../src/services/product.service.js';
import { createFixture, resetDb } from './helpers/db.js';

let f: Awaited<ReturnType<typeof createFixture>>;

beforeEach(async () => {
  await resetDb();
  f = await createFixture();
});
afterAll(() => prisma.$disconnect());

const qtyAt = async (locationId: number, productId = f.product.id) =>
  (
    await prisma.stockQuant.findUnique({
      where: { productId_locationId: { productId, locationId } },
    })
  )?.quantity.toNumber() ?? 0;

type Kind = 'RECEIPT' | 'DELIVERY' | 'INTERNAL';
async function op(
  type: Kind,
  qty: number,
  opts: { from?: number; to?: number; confirm?: boolean } = {},
) {
  const created = await createOperation(
    {
      type,
      sourceLocId: opts.from ?? f.stock.id,
      destLocId: opts.to ?? f.stock.id,
      lines: [{ productId: f.product.id, demandQty: qty }],
    },
    f.user.id,
  );
  return opts.confirm === false ? created : confirmOperation(created.id);
}
const receive = async (qty: number, to = f.stock.id) =>
  validateOperation((await op('RECEIPT', qty, { to })).id, f.user.id);

describe('stock engine', () => {
  it('receipt increases stock and writes a Vendor -> location move', async () => {
    const done = await receive(100);
    expect(done.status).toBe('DONE');
    expect(done.validatedAt).toBeInstanceOf(Date);
    expect(done.reference).toBe('WH1/IN/0001');
    expect(await qtyAt(f.stock.id)).toBe(100);

    const moves = await prisma.stockMove.findMany();
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({
      fromLocId: f.vendor.id,
      toLocId: f.stock.id,
      userId: f.user.id,
    });
    expect(moves[0]!.quantity.toNumber()).toBe(100);
  });

  it('delivery decreases stock', async () => {
    await receive(100);
    const d = await op('DELIVERY', 30.5, { from: f.stock.id });
    expect(d.status).toBe('READY');
    await validateOperation(d.id, f.user.id);
    expect(await qtyAt(f.stock.id)).toBe(69.5);
  });

  it('delivery with insufficient stock fails and changes nothing', async () => {
    await receive(10);
    const d = await op('DELIVERY', 25, { from: f.stock.id });
    expect(d.status).toBe('WAITING');
    const movesBefore = await prisma.stockMove.count();

    await expect(validateOperation(d.id, f.user.id)).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      message: expect.stringContaining('Steel Rods'),
    });
    expect(await qtyAt(f.stock.id)).toBe(10);
    expect(await prisma.stockMove.count()).toBe(movesBefore);
    const after = await prisma.operation.findUniqueOrThrow({
      where: { id: d.id },
      include: { lines: true },
    });
    expect(after.status).toBe('WAITING');
    expect(after.lines[0]!.doneQty.toNumber()).toBe(0);
  });

  it('internal transfer keeps the total constant', async () => {
    await receive(50);
    const t = await op('INTERNAL', 20, { from: f.stock.id, to: f.shelf.id });
    await validateOperation(t.id, f.user.id);
    expect(await qtyAt(f.stock.id)).toBe(30);
    expect(await qtyAt(f.shelf.id)).toBe(20);
    const total = await prisma.stockQuant.aggregate({ _sum: { quantity: true } });
    expect(total._sum.quantity?.toNumber()).toBe(50);
  });

  it('uses doneQty instead of demandQty when set', async () => {
    const r = await op('RECEIPT', 100, { to: f.stock.id });
    await prisma.operationLine.updateMany({ where: { operationId: r.id }, data: { doneQty: 80 } });
    await validateOperation(r.id, f.user.id);
    expect(await qtyAt(f.stock.id)).toBe(80);
  });

  it('adjusts in both directions via Inventory Loss, and reports no change', async () => {
    await receive(50);

    const down = await adjustStock(
      { productId: f.product.id, locationId: f.stock.id, countedQty: 47 },
      f.user.id,
    );
    expect(down).toMatchObject({ previousQty: 50, countedQty: 47, difference: -3 });
    expect(down.operation).toMatchObject({
      type: 'ADJUSTMENT',
      status: 'DONE',
      sourceLocId: f.stock.id,
      destLocId: f.loss.id,
    });
    expect(await qtyAt(f.stock.id)).toBe(47);

    const up = await adjustStock(
      { productId: f.product.id, locationId: f.stock.id, countedQty: 60 },
      f.user.id,
    );
    expect(up.operation).toMatchObject({ sourceLocId: f.loss.id, destLocId: f.stock.id });
    expect(await qtyAt(f.stock.id)).toBe(60);

    const same = await adjustStock(
      { productId: f.product.id, locationId: f.stock.id, countedQty: 60 },
      f.user.id,
    );
    expect(same.operation).toBeNull();
    expect(same.difference).toBe(0);
  });

  it('refuses to validate DRAFT, DONE and CANCELED operations', async () => {
    const draft = await op('RECEIPT', 5, { confirm: false });
    await expect(validateOperation(draft.id, f.user.id)).rejects.toMatchObject({
      code: 'NOT_CONFIRMED',
    });

    const r = await receive(5);
    await expect(validateOperation(r.id, f.user.id)).rejects.toMatchObject({
      code: 'ALREADY_DONE',
    });
    await expect(cancelOperation(r.id)).rejects.toMatchObject({ code: 'ALREADY_DONE' });

    const c = await op('RECEIPT', 5);
    await cancelOperation(c.id);
    await expect(validateOperation(c.id, f.user.id)).rejects.toMatchObject({
      code: 'OPERATION_CANCELED',
    });
    expect(await qtyAt(f.stock.id)).toBe(5);
  });

  it('a validated receipt promotes WAITING deliveries to READY', async () => {
    const d = await op('DELIVERY', 40, { from: f.stock.id });
    expect(d.status).toBe('WAITING');
    await receive(25);
    expect((await prisma.operation.findUniqueOrThrow({ where: { id: d.id } })).status).toBe(
      'WAITING',
    );
    await receive(25);
    expect((await prisma.operation.findUniqueOrThrow({ where: { id: d.id } })).status).toBe(
      'READY',
    );
  });

  it('emits stock:updated after commit', async () => {
    const seen: StockUpdatedEvent[] = [];
    const listener = (e: StockUpdatedEvent) => seen.push(e);
    events.on('stock:updated', listener);
    try {
      const r = await receive(1);
      expect(seen).toEqual([
        { operationId: r.id, reference: r.reference, type: 'RECEIPT', productIds: [f.product.id] },
      ]);
    } finally {
      events.off('stock:updated', listener);
    }
  });

  it('never oversells under concurrent validation', async () => {
    await receive(10);
    const a = await op('DELIVERY', 8, { from: f.stock.id });
    const b = await op('DELIVERY', 8, { from: f.stock.id });
    const results = await Promise.allSettled([
      validateOperation(a.id, f.user.id),
      validateOperation(b.id, f.user.id),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.code).toBe('INSUFFICIENT_STOCK');
    expect(await qtyAt(f.stock.id)).toBe(2);
  });

  it('validating the same operation twice concurrently books it once', async () => {
    const r = await op('RECEIPT', 7, { to: f.stock.id });
    await Promise.allSettled([
      validateOperation(r.id, f.user.id),
      validateOperation(r.id, f.user.id),
    ]);
    expect(await qtyAt(f.stock.id)).toBe(7);
    expect(await prisma.stockMove.count()).toBe(1);
  });

  it('opening stock on product creation is an adjustment in the ledger', async () => {
    const p = await createProduct(
      {
        name: 'Office Chair',
        sku: 'CHR-1',
        uom: 'pcs',
        categoryId: f.category.id,
        reorderMin: 0,
        reorderQty: 0,
        initialQty: 12,
        initialLocationId: f.shelf.id,
      },
      f.user.id,
    );
    expect(await qtyAt(f.shelf.id, p.id)).toBe(12);
    const move = await prisma.stockMove.findFirstOrThrow({
      where: { productId: p.id },
      include: { operation: true },
    });
    expect(move.fromLocId).toBe(f.loss.id);
    expect(move.operation?.type).toBe('ADJUSTMENT');
  });
});

describe('ledger integrity', () => {
  it('quants equal the sum of moves after a mixed sequence', async () => {
    await receive(100);
    await receive(40, f.shelf.id);
    await validateOperation(
      (await op('INTERNAL', 30, { from: f.stock.id, to: f.shelf.id })).id,
      f.user.id,
    );
    await validateOperation((await op('DELIVERY', 55, { from: f.shelf.id })).id, f.user.id);
    await adjustStock(
      { productId: f.product.id, locationId: f.stock.id, countedQty: 68.25 },
      f.user.id,
    );
    await expect(
      validateOperation((await op('DELIVERY', 999, { from: f.stock.id })).id, f.user.id),
    ).rejects.toThrow();

    expect(await qtyAt(f.stock.id)).toBe(68.25);
    expect(await qtyAt(f.shelf.id)).toBe(15);
    const report = await integrityCheck();
    expect(report.balanced).toBe(true);
    expect(report.discrepancies).toEqual([]);
    expect(report.movesChecked).toBe(5);
  });

  it('detects a tampered quant', async () => {
    await receive(10);
    await prisma.stockQuant.update({
      where: { productId_locationId: { productId: f.product.id, locationId: f.stock.id } },
      data: { quantity: 12 },
    });
    const report = await integrityCheck();
    expect(report.balanced).toBe(false);
    expect(report.discrepancies).toEqual([
      expect.objectContaining({ ledgerQty: 10, quantQty: 12, difference: 2 }),
    ]);
  });
});
