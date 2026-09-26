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
const line = (demandQty: number) => [{ productId: f.product.id, demandQty }];

async function flow(type: string, qty: number, extra: object, as = h.staff) {
  const created = await api()
    .post('/api/operations')
    .set(as)
    .send({ type, lines: line(qty), ...extra });
  expect(created.status).toBe(201);
  const confirmed = await api().post(`/api/operations/${created.body.id}/confirm`).set(as);
  return confirmed.body;
}

describe('operations API', () => {
  it('runs receipt -> delivery end to end as STAFF, hiding virtual locations from input', async () => {
    const r = await flow('RECEIPT', 100, { destLocId: f.stock.id, partner: 'Tata Steel' });
    expect(r).toMatchObject({ status: 'READY', reference: 'WH1/IN/0001' });
    expect(r.sourceLoc.type).toBe('VENDOR');

    const v = await api().post(`/api/operations/${r.id}/validate`).set(h.staff);
    expect(v.body.status).toBe('DONE');

    const d = await flow('DELIVERY', 30, { sourceLocId: f.stock.id });
    expect(d.lines[0].availableQty).toBe(100);
    await api().post(`/api/operations/${d.id}/validate`).set(h.staff);

    const stock = (await api().get(`/api/products/${f.product.id}/stock`).set(h.staff)).body;
    expect(stock.total).toBe(70);
  });

  it('returns 422 INSUFFICIENT_STOCK with a readable message', async () => {
    const d = await flow('DELIVERY', 5, { sourceLocId: f.stock.id });
    expect(d.status).toBe('WAITING');
    const res = await api().post(`/api/operations/${d.id}/validate`).set(h.staff);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.message).toContain('Steel Rods');
  });

  it('rejects a virtual location supplied as the internal side', async () => {
    const res = await api()
      .post('/api/operations')
      .set(h.staff)
      .send({ type: 'DELIVERY', sourceLocId: f.vendor.id, lines: line(1) });
    expect(res.body.error.code).toBe('INVALID_LOCATION');
  });

  it('edits drafts fully, READY docs only for done quantities, DONE docs never', async () => {
    const created = (
      await api()
        .post('/api/operations')
        .set(h.staff)
        .send({ type: 'RECEIPT', destLocId: f.stock.id, lines: line(10) })
    ).body;
    const edited = await api()
      .patch(`/api/operations/${created.id}`)
      .set(h.staff)
      .send({ partner: 'ACME', destLocId: f.shelf.id, lines: line(12) });
    expect(edited.body).toMatchObject({ partner: 'ACME', destLocId: f.shelf.id });
    expect(edited.body.lines[0].demandQty).toBe(12);

    await api().post(`/api/operations/${created.id}/confirm`).set(h.staff);
    const partner = await api()
      .patch(`/api/operations/${created.id}`)
      .set(h.staff)
      .send({ partner: 'X' });
    expect(partner.body.error.code).toBe('NOT_EDITABLE');
    const done = await api()
      .patch(`/api/operations/${created.id}`)
      .set(h.staff)
      .send({ lines: [{ productId: f.product.id, demandQty: 12, doneQty: 11 }] });
    expect(done.body.lines[0].doneQty).toBe(11);

    await api().post(`/api/operations/${created.id}/validate`).set(h.staff);
    expect((await api().get(`/api/products/${f.product.id}/stock`).set(h.staff)).body.total).toBe(
      11,
    );
    const after = await api()
      .patch(`/api/operations/${created.id}`)
      .set(h.staff)
      .send({ lines: line(1) });
    expect(after.status).toBe(409);
  });

  it('filters by type, status list, warehouse and search', async () => {
    await flow('RECEIPT', 1, { destLocId: f.stock.id, partner: 'Tata' });
    await flow('DELIVERY', 5, { sourceLocId: f.stock.id, partner: 'Lodha' }); // WAITING
    const byType = (await api().get('/api/operations?type=DELIVERY').set(h.staff)).body;
    expect(byType.total).toBe(1);
    const pending = (await api().get('/api/operations?status=ready,waiting').set(h.staff)).body;
    expect(pending.total).toBe(2);
    const wh = (await api().get(`/api/operations?warehouseId=${f.wh.id}&search=lod`).set(h.staff))
      .body;
    expect(wh.items.map((o: { partner: string }) => o.partner)).toEqual(['Lodha']);
    const bad = await api().get('/api/operations?status=NOPE').set(h.staff);
    expect(bad.status).toBe(400);
  });

  it('cancels non-done documents', async () => {
    const r = await flow('RECEIPT', 1, { destLocId: f.stock.id });
    const res = await api().post(`/api/operations/${r.id}/cancel`).set(h.staff);
    expect(res.body.status).toBe('CANCELED');
  });

  it('renders a PDF slip for deliveries only', async () => {
    const r = await flow('RECEIPT', 5, { destLocId: f.stock.id });
    const d = await flow('DELIVERY', 5, { sourceLocId: f.stock.id, partner: 'Lodha' });
    const pdf = await api().get(`/api/operations/${d.id}/slip.pdf`).set(h.staff).buffer(true);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect((await api().get(`/api/operations/${r.id}/slip.pdf`).set(h.staff)).status).toBe(400);
  });
});

describe('adjustments, moves & integrity API', () => {
  it('adjusts, lists moves with filters, exports CSV and passes the integrity check', async () => {
    const r = await flow('RECEIPT', 50, { destLocId: f.stock.id });
    await api().post(`/api/operations/${r.id}/validate`).set(h.staff);

    const adj = await api()
      .post('/api/adjustments')
      .set(h.staff)
      .send({ productId: f.product.id, locationId: f.stock.id, countedQty: 47, reason: 'Damaged' });
    expect(adj.status).toBe(201);
    expect(adj.body).toMatchObject({ previousQty: 50, difference: -3 });
    const same = await api()
      .post('/api/adjustments')
      .set(h.staff)
      .send({ productId: f.product.id, locationId: f.stock.id, countedQty: 47 });
    expect(same.body.message).toBe('No change');

    const all = (await api().get('/api/moves').set(h.staff)).body;
    expect(all.total).toBe(2);
    expect(all.items[0]).toMatchObject({ quantity: 3, operation: { type: 'ADJUSTMENT' } });
    const receipts = (await api().get('/api/moves?type=RECEIPT').set(h.staff)).body;
    expect(receipts.total).toBe(1);
    const byLoc = (await api().get(`/api/moves?locationId=${f.loss.id}`).set(h.staff)).body;
    expect(byLoc.total).toBe(1);

    const csv = await api().get('/api/moves/export.csv').set(h.staff);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\r\n')).toHaveLength(3);

    const check = (await api().get('/api/moves/integrity-check').set(h.staff)).body;
    expect(check).toMatchObject({ balanced: true, discrepancies: [], movesChecked: 2 });
  });

  it('rejects adjustments on virtual locations and negative counts', async () => {
    const virt = await api()
      .post('/api/adjustments')
      .set(h.staff)
      .send({ productId: f.product.id, locationId: f.customer.id, countedQty: 1 });
    expect(virt.body.error.code).toBe('INVALID_LOCATION');
    const neg = await api()
      .post('/api/adjustments')
      .set(h.staff)
      .send({ productId: f.product.id, locationId: f.stock.id, countedQty: -1 });
    expect(neg.status).toBe(400);
  });
});
