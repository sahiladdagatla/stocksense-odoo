import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { nextOperationReference } from '../src/lib/sequence.js';
import { createFixture, resetDb } from './helpers/db.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('sequence helper', () => {
  it('formats references per warehouse and type', async () => {
    const refs = await prisma.$transaction(async (tx) => [
      await nextOperationReference(tx, 'WH1', 'RECEIPT'),
      await nextOperationReference(tx, 'WH1', 'RECEIPT'),
      await nextOperationReference(tx, 'WH1', 'DELIVERY'),
      await nextOperationReference(tx, 'WH2', 'ADJUSTMENT'),
    ]);
    expect(refs).toEqual(['WH1/IN/0001', 'WH1/IN/0002', 'WH1/OUT/0001', 'WH2/ADJ/0001']);
  });

  it('never hands out duplicates under concurrency', async () => {
    const refs = await Promise.all(
      Array.from({ length: 15 }, () =>
        prisma.$transaction((tx) => nextOperationReference(tx, 'WH1', 'INTERNAL')),
      ),
    );
    expect(new Set(refs).size).toBe(15);
    expect([...refs].sort()).toEqual(
      Array.from({ length: 15 }, (_, i) => `WH1/INT/${String(i + 1).padStart(4, '0')}`),
    );
  });
});

describe('database integrity guards', () => {
  it('rejects negative stock quants', async () => {
    const f = await createFixture();
    await expect(
      prisma.stockQuant.create({
        data: { productId: f.product.id, locationId: f.stock.id, quantity: -1 },
      }),
    ).rejects.toThrow();
  });

  it('keeps the stock ledger append-only', async () => {
    const f = await createFixture();
    const move = await prisma.stockMove.create({
      data: {
        productId: f.product.id,
        fromLocId: f.vendor.id,
        toLocId: f.stock.id,
        quantity: 5,
        userId: f.user.id,
      },
    });
    await expect(
      prisma.stockMove.update({ where: { id: move.id }, data: { quantity: 50 } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.stockMove.delete({ where: { id: move.id } })).rejects.toThrow(
      /append-only/,
    );
  });

  it('rejects non-positive moves and moves to the same location', async () => {
    const f = await createFixture();
    const base = { productId: f.product.id, userId: f.user.id };
    await expect(
      prisma.stockMove.create({
        data: { ...base, fromLocId: f.vendor.id, toLocId: f.stock.id, quantity: 0 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.stockMove.create({
        data: { ...base, fromLocId: f.stock.id, toLocId: f.stock.id, quantity: 1 },
      }),
    ).rejects.toThrow();
  });

  it('requires internal locations to belong to a warehouse and virtual ones not to', async () => {
    const f = await createFixture();
    await expect(
      prisma.location.create({ data: { name: 'X', fullName: 'X', type: 'INTERNAL' } }),
    ).rejects.toThrow();
    await expect(
      prisma.location.create({
        data: { name: 'Y', fullName: 'Y', type: 'CUSTOMER', warehouseId: f.wh.id },
      }),
    ).rejects.toThrow();
  });
});
