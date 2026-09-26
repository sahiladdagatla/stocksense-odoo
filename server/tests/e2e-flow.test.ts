/**
 * The acceptance flow from the brief, driven entirely through the HTTP API:
 * receive 100 kg Steel -> transfer to Production Floor -> deliver 20 -> adjust -3 -> integrity passes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { authHeaders, createFixture, resetDb } from './helpers/db.js';

const app = createApp();
let f: Awaited<ReturnType<typeof createFixture>>;
let staff: Record<string, string>;
let floorId: number;

beforeAll(async () => {
  await resetDb();
  f = await createFixture();
  staff = (await authHeaders()).staff;
  const floor = await prisma.location.create({
    data: {
      name: 'Production Floor',
      fullName: 'WH1/Production Floor',
      type: 'INTERNAL',
      warehouseId: f.wh.id,
    },
  });
  floorId = floor.id;
});
afterAll(() => prisma.$disconnect());

const api = () => request(app);
async function run(body: object) {
  const created = await api().post('/api/operations').set(staff).send(body);
  expect(created.status).toBe(201);
  const confirmed = await api().post(`/api/operations/${created.body.id}/confirm`).set(staff);
  expect(confirmed.body.status).toBe('READY');
  const validated = await api().post(`/api/operations/${created.body.id}/validate`).set(staff);
  expect(validated.body.status).toBe('DONE');
  return validated.body;
}
const stock = async () => (await api().get(`/api/products/${f.product.id}/stock`).set(staff)).body;
const at = (s: { locations: { location: { id: number }; quantity: number }[] }, id: number) =>
  s.locations.find((l) => l.location.id === id)?.quantity ?? 0;

describe('end-to-end: steel through the warehouse', () => {
  it('receive 100 kg -> transfer to production -> deliver 20 -> adjust -3 -> ledger balanced', async () => {
    const line = (q: number) => [{ productId: f.product.id, demandQty: q }];

    await run({ type: 'RECEIPT', destLocId: f.stock.id, partner: 'Tata Steel', lines: line(100) });
    expect((await stock()).total).toBe(100);

    await run({ type: 'INTERNAL', sourceLocId: f.stock.id, destLocId: floorId, lines: line(100) });
    let s = await stock();
    expect(at(s, floorId)).toBe(100);
    expect(s.total).toBe(100);

    await run({
      type: 'DELIVERY',
      sourceLocId: floorId,
      partner: 'Lodha Developers',
      lines: line(20),
    });
    expect(at(await stock(), floorId)).toBe(80);

    const adj = await api()
      .post('/api/adjustments')
      .set(staff)
      .send({ productId: f.product.id, locationId: floorId, countedQty: 77, reason: 'Offcuts' });
    expect(adj.body).toMatchObject({ previousQty: 80, difference: -3 });

    s = await stock();
    expect(s.total).toBe(77);
    expect(at(s, floorId)).toBe(77);

    const check = (await api().get('/api/moves/integrity-check').set(staff)).body;
    expect(check).toMatchObject({ balanced: true, discrepancies: [], movesChecked: 4 });

    const ledger = (await api().get(`/api/moves?productId=${f.product.id}`).set(staff)).body;
    expect(ledger.items.map((m: { operation: { type: string } }) => m.operation.type)).toEqual([
      'ADJUSTMENT',
      'DELIVERY',
      'INTERNAL',
      'RECEIPT',
    ]);
  });
});
