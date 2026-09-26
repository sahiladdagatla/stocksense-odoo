/**
 * Real-life edge cases across the API: bad input, odd quantities, multi-line rollbacks, lifecycle
 * misuse, referential integrity, search escaping and role boundaries.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { authHeaders, createFixture, resetDb } from './helpers/db.js';
import { events } from '../src/lib/events.js';

const app = createApp();
let f: Awaited<ReturnType<typeof createFixture>>;
let h: Awaited<ReturnType<typeof authHeaders>>;

beforeEach(async () => {
  await resetDb();
  f = await createFixture();
  h = await authHeaders();
});
afterAll(() => prisma.$disconnect());

const api = () => request(app);
const post = (url: string, body: object = {}) => api().post(url).set(h.staff).send(body);
const get = (url: string) => api().get(url).set(h.staff);

async function doc(
  type: string,
  lines: { productId: number; demandQty: number }[],
  extra: object = {},
) {
  const res = await post('/api/operations', {
    type,
    sourceLocId: f.stock.id,
    destLocId: type === 'INTERNAL' ? f.shelf.id : f.stock.id,
    lines,
    ...extra,
  });
  expect(res.status).toBe(201);
  return res.body as { id: number; reference: string; status: string };
}
const confirm = (id: number) => post(`/api/operations/${id}/confirm`);
const validate = (id: number) => post(`/api/operations/${id}/validate`);
async function receive(qty: number, productId = f.product.id, destLocId = f.stock.id) {
  const d = await doc('RECEIPT', [{ productId, demandQty: qty }], { destLocId });
  await confirm(d.id);
  expect((await validate(d.id)).status).toBe(200);
}
const onHand = async (productId = f.product.id, locationId = f.stock.id) =>
  (
    await prisma.stockQuant.findUnique({
      where: { productId_locationId: { productId, locationId } },
    })
  )?.quantity.toNumber() ?? 0;

describe('input validation', () => {
  it('rejects zero, negative, non-numeric and over-precise quantities', async () => {
    for (const demandQty of [0, -5, 'abc', 0.0001]) {
      const res = await post('/api/operations', {
        type: 'RECEIPT',
        destLocId: f.stock.id,
        lines: [{ productId: f.product.id, demandQty }],
      });
      expect(res.status, `demandQty=${demandQty}`).toBe(400);
    }
  });

  it('accepts 3-decimal quantities and keeps them exact through the ledger', async () => {
    await receive(0.1);
    await receive(0.2);
    expect(await onHand()).toBe(0.3); // no floating-point drift: Decimal end to end
    await receive(12.345);
    expect(await onHand()).toBe(12.645);
  });

  it('rejects empty lines, duplicate products and unknown products', async () => {
    const base = { type: 'RECEIPT', destLocId: f.stock.id };
    expect((await post('/api/operations', { ...base, lines: [] })).status).toBe(400);
    const dup = await post('/api/operations', {
      ...base,
      lines: [
        { productId: f.product.id, demandQty: 1 },
        { productId: f.product.id, demandQty: 2 },
      ],
    });
    expect(dup.body.error.message).toMatch(/only once/);
    const ghost = await post('/api/operations', {
      ...base,
      lines: [{ productId: 99999, demandQty: 1 }],
    });
    expect(ghost.status).toBe(404);
  });

  it('returns 400 for malformed ids and dates, 404 for unknown ids', async () => {
    expect((await get('/api/operations/abc')).status).toBe(400);
    expect((await get('/api/operations/-1')).status).toBe(400);
    expect((await get('/api/operations/99999')).status).toBe(404);
    expect((await get('/api/products/99999/stock')).status).toBe(404);
    const badDate = await post('/api/operations', {
      type: 'RECEIPT',
      destLocId: f.stock.id,
      scheduledDate: 'next tuesday',
      lines: [{ productId: f.product.id, demandQty: 1 }],
    });
    expect(badDate.status).toBe(400);
    expect((await get('/api/operations?page=0')).status).toBe(400);
    expect((await get('/api/operations?pageSize=5000')).status).toBe(400);
  });

  it('rejects oversized notes and requires the internal side of each document', async () => {
    const long = await post('/api/operations', {
      type: 'RECEIPT',
      destLocId: f.stock.id,
      notes: 'x'.repeat(1001),
      lines: [{ productId: f.product.id, demandQty: 1 }],
    });
    expect(long.status).toBe(400);
    const noDest = await post('/api/operations', {
      type: 'RECEIPT',
      lines: [{ productId: f.product.id, demandQty: 1 }],
    });
    expect(noDest.body.error.code).toBe('LOCATION_REQUIRED');
    const same = await post('/api/operations', {
      type: 'INTERNAL',
      sourceLocId: f.stock.id,
      destLocId: f.stock.id,
      lines: [{ productId: f.product.id, demandQty: 1 }],
    });
    expect(same.body.error.code).toBe('SAME_LOCATION');
  });
});

describe('multi-line documents', () => {
  it('rolls back the whole delivery when any single line is short', async () => {
    const chair = await prisma.product.create({
      data: { name: 'Office Chair', sku: 'CHR', uom: 'pcs', categoryId: f.category.id },
    });
    await receive(50);
    await receive(2, chair.id);
    const d = await doc('DELIVERY', [
      { productId: f.product.id, demandQty: 10 },
      { productId: chair.id, demandQty: 5 },
    ]);
    await confirm(d.id);
    const res = await validate(d.id);
    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain('Office Chair');
    // The steel line, which had enough stock, must not have moved either.
    expect(await onHand()).toBe(50);
    expect(await onHand(chair.id)).toBe(2);
    expect(await prisma.stockMove.count({ where: { operationId: d.id } })).toBe(0);
  });

  it('records a partial delivery with done qty below demand, and over-receipt above it', async () => {
    await receive(100);
    const d = await doc('DELIVERY', [{ productId: f.product.id, demandQty: 40 }]);
    await confirm(d.id);
    await api()
      .patch(`/api/operations/${d.id}`)
      .set(h.staff)
      .send({ lines: [{ productId: f.product.id, demandQty: 40, doneQty: 25 }] });
    await validate(d.id);
    expect(await onHand()).toBe(75);

    const r = await doc('RECEIPT', [{ productId: f.product.id, demandQty: 10 }]);
    await confirm(r.id);
    await api()
      .patch(`/api/operations/${r.id}`)
      .set(h.staff)
      .send({ lines: [{ productId: f.product.id, demandQty: 10, doneQty: 12 }] });
    await validate(r.id);
    expect(await onHand()).toBe(87);
  });

  it('rejects a done qty larger than the stock at the source', async () => {
    await receive(10);
    const d = await doc('DELIVERY', [{ productId: f.product.id, demandQty: 5 }]);
    await confirm(d.id);
    await api()
      .patch(`/api/operations/${d.id}`)
      .set(h.staff)
      .send({ lines: [{ productId: f.product.id, demandQty: 5, doneQty: 11 }] });
    expect((await validate(d.id)).body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(await onHand()).toBe(10);
  });
});

describe('lifecycle misuse', () => {
  it('cannot confirm twice, edit confirmed demand, or validate a canceled waiting delivery', async () => {
    const d = await doc('DELIVERY', [{ productId: f.product.id, demandQty: 5 }]);
    expect((await confirm(d.id)).body.status).toBe('WAITING');
    expect((await confirm(d.id)).body.error.code).toBe('NOT_DRAFT');
    const edit = await api()
      .patch(`/api/operations/${d.id}`)
      .set(h.staff)
      .send({ lines: [{ productId: f.product.id, demandQty: 50 }] });
    expect(edit.body.error.code).toBe('NOT_EDITABLE');
    expect((await post(`/api/operations/${d.id}/cancel`)).body.status).toBe('CANCELED');
    await receive(10);
    // A canceled document is never revived by the waiting re-check.
    expect((await get(`/api/operations/${d.id}`)).body.status).toBe('CANCELED');
    expect((await validate(d.id)).body.error.code).toBe('OPERATION_CANCELED');
  });

  it('a positive stock count promotes waiting deliveries, a transfer into the source does too', async () => {
    const d = await doc('DELIVERY', [{ productId: f.product.id, demandQty: 5 }]);
    await confirm(d.id);
    await post('/api/adjustments', {
      productId: f.product.id,
      locationId: f.stock.id,
      countedQty: 5,
    });
    expect((await get(`/api/operations/${d.id}`)).body.status).toBe('READY');

    const d2 = await doc('DELIVERY', [{ productId: f.product.id, demandQty: 3 }], {
      sourceLocId: f.shelf.id,
    });
    await confirm(d2.id);
    const t = await doc('INTERNAL', [{ productId: f.product.id, demandQty: 3 }]);
    await confirm(t.id);
    await validate(t.id);
    expect((await get(`/api/operations/${d2.id}`)).body.status).toBe('READY');
  });

  it('stock is tracked per exact location: stock on a rack is not available from its parent', async () => {
    await receive(10, f.product.id, f.shelf.id);
    const d = await doc('DELIVERY', [{ productId: f.product.id, demandQty: 5 }]);
    expect((await confirm(d.id)).body.status).toBe('WAITING');
  });

  it('numbers references per warehouse and type, and canceled numbers are not reused', async () => {
    const wh2 = await prisma.warehouse.create({ data: { code: 'WH2', name: 'Second' } });
    const s2 = await prisma.location.create({
      data: { name: 'Stock', fullName: 'WH2/Stock', type: 'INTERNAL', warehouseId: wh2.id },
    });
    const a = await doc('RECEIPT', [{ productId: f.product.id, demandQty: 1 }]);
    await post(`/api/operations/${a.id}/cancel`);
    const b = await doc('RECEIPT', [{ productId: f.product.id, demandQty: 1 }]);
    const c = await doc('RECEIPT', [{ productId: f.product.id, demandQty: 1 }], {
      destLocId: s2.id,
    });
    const t = await doc('INTERNAL', [{ productId: f.product.id, demandQty: 1 }], {
      sourceLocId: s2.id,
      destLocId: f.stock.id,
    });
    expect([a.reference, b.reference, c.reference, t.reference]).toEqual([
      'WH1/IN/0001',
      'WH1/IN/0002',
      'WH2/IN/0001',
      'WH2/INT/0001',
    ]);
  });
});

describe('referential integrity', () => {
  it('protects products and locations that have history, allows deleting unused ones', async () => {
    await receive(5);
    const usedDelete = await api().delete(`/api/products/${f.product.id}`).set(h.manager);
    expect(usedDelete.status).toBe(409);
    expect(usedDelete.body.error.code).toBe('IN_USE');

    const fresh = await prisma.product.create({
      data: { name: 'Unused', sku: 'UNU', uom: 'pcs', categoryId: f.category.id },
    });
    expect((await api().delete(`/api/products/${fresh.id}`).set(h.manager)).status).toBe(204);

    // Shelf has no stock but appears on a draft transfer: the FK blocks deletion.
    await doc('INTERNAL', [{ productId: f.product.id, demandQty: 1 }]);
    expect((await api().delete(`/api/locations/${f.shelf.id}`).set(h.manager)).status).toBe(409);
  });

  it('rejects renaming a location onto an existing path', async () => {
    const other = await prisma.location.create({
      data: {
        name: 'Other',
        fullName: 'WH1/Stock/Other',
        type: 'INTERNAL',
        warehouseId: f.wh.id,
        parentId: f.stock.id,
      },
    });
    const res = await api()
      .patch(`/api/locations/${other.id}`)
      .set(h.manager)
      .send({ name: 'Shelf' });
    expect(res.status).toBe(409);
  });

  it('renames with LIKE wildcards in the name without touching unrelated paths', async () => {
    const pct = await prisma.location.create({
      data: { name: 'Bay_1%', fullName: 'WH1/Bay_1%', type: 'INTERNAL', warehouseId: f.wh.id },
    });
    await prisma.location.create({
      data: {
        name: 'Child',
        fullName: 'WH1/Bay_1%/Child',
        type: 'INTERNAL',
        warehouseId: f.wh.id,
        parentId: pct.id,
      },
    });
    const decoy = await prisma.location.create({
      data: { name: 'BayX1Z', fullName: 'WH1/BayX1Z', type: 'INTERNAL', warehouseId: f.wh.id },
    });
    await prisma.location.create({
      data: {
        name: 'Kid',
        fullName: 'WH1/BayX1Z/Kid',
        type: 'INTERNAL',
        warehouseId: f.wh.id,
        parentId: decoy.id,
      },
    });

    await api().patch(`/api/locations/${pct.id}`).set(h.manager).send({ name: 'Bay 1' });
    const names = (
      await prisma.location.findMany({
        where: { warehouseId: f.wh.id },
        orderBy: { fullName: 'asc' },
      })
    ).map((l) => l.fullName);
    expect(names).toContain('WH1/Bay 1/Child');
    expect(names).toContain('WH1/BayX1Z/Kid');
  });

  it('refuses to delete a category or warehouse that is still in use', async () => {
    expect((await api().delete(`/api/categories/${f.category.id}`).set(h.manager)).status).toBe(
      409,
    );
    expect((await api().delete(`/api/warehouses/${f.wh.id}`).set(h.manager)).status).toBe(409);
  });
});

describe('search and filters', () => {
  it('treats % and _ in search text literally', async () => {
    await prisma.product.create({
      data: { name: '100% Cotton Rag', sku: 'RAG-1', uom: 'pcs', categoryId: f.category.id },
    });
    const pct = await get('/api/products?search=%25');
    expect(pct.body.items.map((p: { sku: string }) => p.sku)).toEqual(['RAG-1']);
    const underscore = await get('/api/products?search=_');
    expect(underscore.body.total).toBe(0);
  });

  it('filters moves by date range and returns an empty page past the end', async () => {
    await receive(5);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect((await get(`/api/moves?from=${future}`)).body.total).toBe(0);
    expect((await get(`/api/moves?to=${future}`)).body.total).toBe(1);
    const past = await get('/api/moves?page=50');
    expect(past.body).toMatchObject({ total: 1, items: [] });
  });

  it('scopes dashboard KPIs to a warehouse', async () => {
    const wh2 = await prisma.warehouse.create({ data: { code: 'WH2', name: 'Second' } });
    await receive(5);
    const k1 = (await get(`/api/dashboard/kpis?warehouseId=${f.wh.id}`)).body;
    const k2 = (await get(`/api/dashboard/kpis?warehouseId=${wh2.id}`)).body;
    expect(k1.productsInStock).toBe(1);
    expect(k2.productsInStock).toBe(0);
    expect(k2.outOfStock).toBe(1);
  });
});

describe('adjustments', () => {
  it('counts down to zero, counts a location that never held stock, and rejects unknown products', async () => {
    await receive(4);
    const zero = await post('/api/adjustments', {
      productId: f.product.id,
      locationId: f.stock.id,
      countedQty: 0,
    });
    expect(zero.body.difference).toBe(-4);
    expect(await onHand()).toBe(0);

    const found = await post('/api/adjustments', {
      productId: f.product.id,
      locationId: f.shelf.id,
      countedQty: 7,
    });
    expect(found.body).toMatchObject({ previousQty: 0, difference: 7 });

    const ghost = await post('/api/adjustments', {
      productId: 99999,
      locationId: f.shelf.id,
      countedQty: 1,
    });
    expect(ghost.status).toBe(404);
    const report = (await get('/api/moves/integrity-check')).body;
    expect(report.balanced).toBe(true);
  });
});

describe('roles', () => {
  it('staff run every operation type but cannot change master data', async () => {
    await receive(10);
    const t = await doc('INTERNAL', [{ productId: f.product.id, demandQty: 2 }]);
    await confirm(t.id);
    expect((await validate(t.id)).status).toBe(200);
    expect(
      (
        await post('/api/adjustments', {
          productId: f.product.id,
          locationId: f.stock.id,
          countedQty: 1,
        })
      ).status,
    ).toBe(201);

    const create = await api().post('/api/products').set(h.staff).send({
      name: 'X',
      sku: 'X-1',
      uom: 'pcs',
      categoryId: f.category.id,
      initialQty: 5,
      initialLocationId: f.stock.id,
    });
    expect(create.status).toBe(403);
    expect(await prisma.product.count({ where: { sku: 'X-1' } })).toBe(0);
  });
});

describe('real-time notifications', () => {
  it('announces waiting documents promoted to READY, before the stock event', async () => {
    const d = await doc('DELIVERY', [{ productId: f.product.id, demandQty: 5 }]);
    await confirm(d.id);
    const seen: string[] = [];
    const onOp = (e: { operationId: number; status: string }) =>
      seen.push(`op:${e.operationId}:${e.status}`);
    const onStock = () => seen.push('stock');
    events.on('operation:changed', onOp);
    events.on('stock:updated', onStock);
    try {
      await receive(5);
    } finally {
      events.off('operation:changed', onOp);
      events.off('stock:updated', onStock);
    }
    const promoted = seen.indexOf(`op:${d.id}:READY`);
    expect(promoted).toBeGreaterThanOrEqual(0);
    expect(promoted).toBeLessThan(seen.lastIndexOf('stock'));
  });
});
