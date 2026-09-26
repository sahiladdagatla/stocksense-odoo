import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { authHeaders, createFixture, resetDb } from './helpers/db.js';

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

/** Creates and confirms a one-line document, optionally records a done qty, then validates. */
async function partial(
  type: 'RECEIPT' | 'DELIVERY',
  demand: number,
  done: number | null,
  validateBody: object = {},
) {
  const created = await api()
    .post('/api/operations')
    .set(h.staff)
    .send({
      type,
      sourceLocId: f.stock.id,
      destLocId: f.stock.id,
      partner: 'ACME',
      lines: [{ productId: f.product.id, demandQty: demand }],
    });
  await api().post(`/api/operations/${created.body.id}/confirm`).set(h.staff);
  if (done !== null) {
    await api()
      .patch(`/api/operations/${created.body.id}`)
      .set(h.staff)
      .send({ lines: [{ productId: f.product.id, demandQty: demand, doneQty: done }] });
  }
  const res = await api()
    .post(`/api/operations/${created.body.id}/validate`)
    .set(h.staff)
    .send(validateBody);
  expect(res.status).toBe(200);
  return res.body;
}

describe('backorders', () => {
  it('a partial receipt creates a READY backorder for the remainder, linked both ways', async () => {
    const r = await partial('RECEIPT', 100, 60);
    expect(r.status).toBe('DONE');
    expect(r.backorders).toHaveLength(1);

    const bo = (await api().get(`/api/operations/${r.backorders[0].id}`).set(h.staff)).body;
    expect(bo).toMatchObject({
      type: 'RECEIPT',
      status: 'READY',
      partner: 'ACME',
      reference: 'WH1/IN/0002',
      backorderOf: { id: r.id, reference: r.reference },
    });
    expect(bo.lines.map((l: { demandQty: number }) => l.demandQty)).toEqual([40]);
    expect(bo.notes).toBe(`Backorder of ${r.reference}`);
  });

  it('a partial delivery backorder waits when the rest is not in stock, and is ready when it is', async () => {
    await partial('RECEIPT', 30, null); // 30 in stock
    const d = await partial('DELIVERY', 40, 30); // ship all 30, 10 remain
    const waiting = (await api().get(`/api/operations/${d.backorders[0].id}`).set(h.staff)).body;
    expect(waiting.status).toBe('WAITING');

    await partial('RECEIPT', 10, null);
    const ready = (await api().get(`/api/operations/${d.backorders[0].id}`).set(h.staff)).body;
    expect(ready.status).toBe('READY'); // promoted by the stock that arrived
  });

  it('skips the backorder when asked, and never creates one for full or over-quantity validation', async () => {
    const none = await partial('RECEIPT', 50, 20, { createBackorder: false });
    expect(none.backorders).toEqual([]);
    const full = await partial('RECEIPT', 50, null);
    expect(full.backorders).toEqual([]);
    const over = await partial('RECEIPT', 50, 55);
    expect(over.backorders).toEqual([]);
    expect(await prisma.operation.count()).toBe(3);
  });

  it('the ledger stays balanced across partial validations and their backorders', async () => {
    const r = await partial('RECEIPT', 100, 70);
    await api().post(`/api/operations/${r.backorders[0].id}/validate`).set(h.staff).send({});
    await partial('DELIVERY', 80, 50);
    const check = (await api().get('/api/moves/integrity-check').set(h.staff)).body;
    expect(check.balanced).toBe(true);
    const stock = (await api().get(`/api/products/${f.product.id}/stock`).set(h.staff)).body;
    expect(stock.total).toBe(50); // 70 + 30 received, 50 delivered
  });

  it('rejects a malformed validate body', async () => {
    const res = await api()
      .post('/api/operations/1/validate')
      .set(h.staff)
      .send({ createBackorder: 'yes' });
    expect(res.status).toBe(400);
  });
});
