import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { authHeaders, resetDb } from './helpers/db.js';

const app = createApp();
let h: Awaited<ReturnType<typeof authHeaders>>;

beforeEach(async () => {
  await resetDb();
  h = await authHeaders();
});
afterAll(() => prisma.$disconnect());

const api = () => request(app);
const productBody = (categoryId: number, extra: object = {}) => ({
  name: 'A',
  sku: 'A-1',
  uom: 'pcs',
  categoryId,
  ...extra,
});

async function setup() {
  const wh = (
    await api().post('/api/warehouses').set(h.manager).send({ name: 'Main', code: 'wh1' })
  ).body;
  const stock = (
    await api().post('/api/locations').set(h.manager).send({ name: 'Stock', warehouseId: wh.id })
  ).body;
  const rack = (
    await api()
      .post('/api/locations')
      .set(h.manager)
      .send({ name: 'Rack A', warehouseId: wh.id, parentId: stock.id })
  ).body;
  const cat = (await api().post('/api/categories').set(h.manager).send({ name: 'Raw' })).body;
  return { wh, stock, rack, cat };
}

describe('warehouses & locations', () => {
  it('builds full paths and a nested tree', async () => {
    const { wh, rack } = await setup();
    expect(wh.code).toBe('WH1');
    expect(rack.fullName).toBe('WH1/Stock/Rack A');

    const tree = (await api().get('/api/locations/tree').set(h.staff)).body;
    expect(tree[0].locations[0].name).toBe('Stock');
    expect(tree[0].locations[0].children[0].name).toBe('Rack A');
  });

  it('renaming a parent rewrites descendant paths', async () => {
    const { stock, rack } = await setup();
    await api().patch(`/api/locations/${stock.id}`).set(h.manager).send({ name: 'Main Stock' });
    const updated = (await api().get(`/api/locations/${rack.id}`).set(h.staff)).body;
    expect(updated.fullName).toBe('WH1/Main Stock/Rack A');
  });

  it('blocks deleting non-empty warehouses, parents and stocked locations', async () => {
    const { wh, stock, rack, cat } = await setup();
    expect((await api().delete(`/api/warehouses/${wh.id}`).set(h.manager)).status).toBe(409);
    const parentDel = await api().delete(`/api/locations/${stock.id}`).set(h.manager);
    expect(parentDel.body.error.code).toBe('LOCATION_HAS_CHILDREN');

    const p = await prisma.product.create({ data: { ...productBody(cat.id) } });
    await prisma.stockQuant.create({ data: { productId: p.id, locationId: rack.id, quantity: 5 } });
    const stockedDel = await api().delete(`/api/locations/${rack.id}`).set(h.manager);
    expect(stockedDel.body.error.code).toBe('LOCATION_HAS_STOCK');
  });

  it('rejects duplicate warehouse codes and duplicate paths', async () => {
    const { wh } = await setup();
    const dupWh = await api()
      .post('/api/warehouses')
      .set(h.manager)
      .send({ name: 'X', code: 'WH1' });
    expect(dupWh.status).toBe(409);
    const dupLoc = await api()
      .post('/api/locations')
      .set(h.manager)
      .send({ name: 'Stock', warehouseId: wh.id });
    expect(dupLoc.status).toBe(409);
  });
});

describe('products & categories', () => {
  it('creates, searches by name or SKU, and reports stock status', async () => {
    const { cat, stock, rack } = await setup();
    const mk = (name: string, sku: string, reorderMin: number) =>
      api()
        .post('/api/products')
        .set(h.manager)
        .send(productBody(cat.id, { name, sku, reorderMin }));
    const steel = (await mk('Steel Rods', 'stl-1', 10)).body;
    const alu = (await mk('Aluminium', 'ALU-1', 10)).body;
    await mk('Chair', 'CHR-1', 0);
    expect(steel.sku).toBe('STL-1');
    expect(steel.reorderMin).toBe(10); // Decimal serialised as a number

    await prisma.stockQuant.createMany({
      data: [
        { productId: steel.id, locationId: stock.id, quantity: 30 },
        { productId: steel.id, locationId: rack.id, quantity: 12.5 },
        { productId: alu.id, locationId: stock.id, quantity: 4 },
      ],
    });

    const bySku = (await api().get('/api/products?search=stl').set(h.staff)).body;
    expect(bySku.items).toHaveLength(1);
    expect(bySku.items[0]).toMatchObject({
      name: 'Steel Rods',
      onHand: 42.5,
      stockStatus: 'IN_STOCK',
    });

    const paged = (await api().get(`/api/products?categoryId=${cat.id}&pageSize=2`).set(h.staff))
      .body;
    expect(paged.total).toBe(3);
    expect(paged.items).toHaveLength(2);

    const all = (await api().get('/api/products').set(h.staff)).body.items as {
      sku: string;
      stockStatus: string;
    }[];
    expect(all.map((p) => `${p.sku}:${p.stockStatus}`)).toEqual([
      'ALU-1:LOW',
      'CHR-1:OUT',
      'STL-1:IN_STOCK',
    ]);

    const detail = (await api().get(`/api/products/${steel.id}/stock`).set(h.staff)).body;
    expect(detail.total).toBe(42.5);
    expect(
      detail.locations.map((l: { location: { fullName: string } }) => l.location.fullName),
    ).toEqual(['WH1/Stock', 'WH1/Stock/Rack A']);
    expect(detail.daysLeft).toBeNull(); // no outflow yet

    const low = (await api().get('/api/products?stockStatus=LOW').set(h.staff)).body;
    expect(low.items.map((p: { sku: string }) => p.sku)).toEqual(['ALU-1']);
    expect(low.total).toBe(1);

    expect((await api().get('/api/products/sku/stl-1').set(h.staff)).body.id).toBe(steel.id);
  });

  it('validates input and rejects duplicate SKUs', async () => {
    const { cat } = await setup();
    await api().post('/api/products').set(h.manager).send(productBody(cat.id));
    const dup = await api().post('/api/products').set(h.manager).send(productBody(cat.id));
    expect(dup.status).toBe(409);
    const bad = await api()
      .post('/api/products')
      .set(h.manager)
      .send(productBody(cat.id, { sku: 'B-2', reorderMin: -1 }));
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('blocks deleting a category that still has products', async () => {
    const { cat } = await setup();
    await api().post('/api/products').set(h.manager).send(productBody(cat.id));
    const res = await api().delete(`/api/categories/${cat.id}`).set(h.manager);
    expect(res.body.error.code).toBe('CATEGORY_IN_USE');
  });
});

describe('roles', () => {
  it('staff can read master data but gets 403 on every write', async () => {
    const { wh, stock, cat } = await setup();
    const p = (await api().post('/api/products').set(h.manager).send(productBody(cat.id))).body;

    for (const path of ['/api/warehouses', '/api/locations', '/api/categories', '/api/products']) {
      expect((await api().get(path).set(h.staff)).status).toBe(200);
    }
    const writes = [
      api().post('/api/warehouses').send({ name: 'X', code: 'X1' }),
      api().patch(`/api/warehouses/${wh.id}`).send({ name: 'X' }),
      api().post('/api/locations').send({ name: 'X', warehouseId: wh.id }),
      api().delete(`/api/locations/${stock.id}`),
      api().post('/api/categories').send({ name: 'X' }),
      api().patch(`/api/products/${p.id}`).send({ name: 'X' }),
      api().delete(`/api/products/${p.id}`),
    ];
    for (const req of writes) expect((await req.set(h.staff)).status).toBe(403);
  });

  it('requires authentication', async () => {
    expect((await api().get('/api/products')).status).toBe(401);
  });
});
