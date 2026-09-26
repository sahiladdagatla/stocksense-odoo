import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { io as connect, type Socket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { signToken } from '../src/lib/jwt.js';
import { initSocket } from '../src/lib/socket.js';
import { adjustStock, validateOperation } from '../src/services/stock.service.js';
import { confirmOperation, createOperation } from '../src/services/operation.service.js';
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

type Kind = 'RECEIPT' | 'DELIVERY' | 'INTERNAL';
async function op(type: Kind, qty: number, validate: boolean, productId = f.product.id) {
  const o = await createOperation(
    {
      type,
      sourceLocId: f.stock.id,
      destLocId: f.stock.id,
      lines: [{ productId, demandQty: qty }],
    },
    f.user.id,
  );
  await confirmOperation(o.id);
  if (validate) await validateOperation(o.id, f.user.id);
  return o;
}

describe('dashboard API', () => {
  it('computes KPIs, the 7-day chart and the reorder list', async () => {
    await prisma.product.update({
      where: { id: f.product.id },
      data: { reorderMin: 50, reorderQty: 200 },
    });
    const chair = await prisma.product.create({
      data: { name: 'Chair', sku: 'CHR', uom: 'pcs', categoryId: f.category.id, reorderMin: 2 },
    });
    await prisma.product.create({
      data: { name: 'Desk', sku: 'DSK', uom: 'pcs', categoryId: f.category.id },
    });

    await op('RECEIPT', 100, true);
    await op('DELIVERY', 56, true); // steel: 44 left, below min 50 -> LOW
    await op('RECEIPT', 10, true, chair.id); // chair: IN_STOCK
    await op('RECEIPT', 5, false); // pending receipt
    await op('DELIVERY', 1, false); // pending delivery (READY)
    await adjustStock(
      { productId: f.product.id, locationId: f.stock.id, countedQty: 42 },
      f.user.id,
    );

    const k = (await request(app).get('/api/dashboard/kpis').set(h.staff)).body;
    expect(k).toMatchObject({
      productsInStock: 2,
      lowStock: 1,
      outOfStock: 1,
      pendingReceipts: 1,
      pendingDeliveries: 1,
      deliveriesReady: 1,
      scheduledTransfers: 0,
    });

    const chart = (
      await request(app).get('/api/dashboard/movement-chart?tzOffset=-330').set(h.staff)
    ).body;
    expect(chart.days).toHaveLength(7);
    expect(chart.totalInbound).toBe(110);
    expect(chart.totalOutbound).toBe(58); // 56 delivered + 2 lost in the count
    expect(chart.days[6]).toMatchObject({ inbound: 110, outbound: 58 });

    const reorder = (await request(app).get('/api/dashboard/reorder').set(h.staff)).body;
    expect(reorder.map((r: { product: { sku: string } }) => r.product.sku)).toEqual([
      'DSK',
      'STL-1',
    ]);
    expect(reorder[1]).toMatchObject({
      onHand: 42,
      reorderQty: 200,
      incomingQty: 5,
      avgDailyOut: 4.143,
      daysLeft: 10,
    });

    const filtered = (await request(app).get(`/api/dashboard/kpis?categoryId=999`).set(h.staff))
      .body;
    expect(filtered.productsInStock).toBe(0);
  });
});

describe('socket.io', () => {
  it('rejects unauthenticated sockets and pushes stock:updated to authenticated ones', async () => {
    const server = http.createServer(app);
    const rt = initSocket(server);
    await new Promise<void>((r) => server.listen(0, r));
    const url = `http://localhost:${(server.address() as AddressInfo).port}`;
    const sockets: Socket[] = [];
    try {
      const anon = connect(url, { auth: {}, transports: ['websocket'] });
      sockets.push(anon);
      const err = await new Promise<Error>((r) => anon.on('connect_error', r));
      expect(err.message).toBe('UNAUTHORIZED');

      const client = connect(url, {
        auth: { token: signToken(f.user) },
        transports: ['websocket'],
      });
      sockets.push(client);
      await new Promise<void>((r) => client.on('connect', () => r()));
      const received = new Promise<{ reference: string }>((r) => client.on('stock:updated', r));
      const changed = new Promise<{ status: string }>((r) => client.on('operation:changed', r));

      const o = await op('RECEIPT', 3, true);
      expect((await changed).status).toBe('DRAFT');
      expect((await received).reference).toBe(o.reference);
    } finally {
      sockets.forEach((s) => s.close());
      await rt.close();
      await new Promise((r) => server.close(r));
    }
  });
});
