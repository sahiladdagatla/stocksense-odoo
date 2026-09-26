/**
 * Demo seed. WARNING: wipes ALL data in the target database, then recreates it.
 * Run with `npm run seed`.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { hashSecret } from '../src/lib/password.js';
import {
  CATEGORIES,
  INTERNAL_LOCATIONS,
  PRODUCTS,
  USERS,
  VIRTUAL_LOCATIONS,
  WAREHOUSES,
} from './seed-data.js';

/** Map lookup that fails loudly instead of silently inserting undefined. */
function must<V>(map: Map<string, V>, key: string): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Seed reference not found: ${key}`);
  return value;
}

async function wipe() {
  // TRUNCATE bypasses the StockMove append-only trigger, which only fires on UPDATE/DELETE.
  await prisma.$executeRawUnsafe(`
    TRUNCATE "StockMove", "OperationLine", "Operation", "StockQuant", "Product", "Category",
             "Location", "Warehouse", "User", "Sequence" RESTART IDENTITY CASCADE
  `);
}

async function seedMasterData() {
  for (const u of USERS) {
    await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        role: u.role,
        passwordHash: await hashSecret(u.password),
      },
    });
  }

  await prisma.location.createMany({ data: VIRTUAL_LOCATIONS });

  const warehouseIds = new Map<string, number>();
  for (const w of WAREHOUSES) {
    const created = await prisma.warehouse.create({ data: w });
    warehouseIds.set(w.code, created.id);
  }

  const locationIds = new Map<string, number>();
  for (const l of INTERNAL_LOCATIONS) {
    const prefix = l.parent ?? l.warehouse;
    const fullName = `${prefix}/${l.name}`;
    const created = await prisma.location.create({
      data: {
        name: l.name,
        fullName,
        type: 'INTERNAL',
        warehouseId: must(warehouseIds, l.warehouse),
        parentId: l.parent ? must(locationIds, l.parent) : null,
      },
    });
    locationIds.set(fullName, created.id);
  }

  const categoryIds = new Map<string, number>();
  for (const name of CATEGORIES) {
    const created = await prisma.category.create({ data: { name } });
    categoryIds.set(name, created.id);
  }

  await prisma.product.createMany({
    data: PRODUCTS.map((p) => ({
      sku: p.sku,
      name: p.name,
      uom: p.uom,
      categoryId: must(categoryIds, p.category),
      reorderMin: p.reorderMin,
      reorderQty: p.reorderQty,
    })),
  });
}

async function main() {
  const started = Date.now();
  console.log('Seeding StockSense (this wipes existing data)…');
  await wipe();
  await seedMasterData();

  const [users, locations, products] = await Promise.all([
    prisma.user.count(),
    prisma.location.count(),
    prisma.product.count(),
  ]);
  console.log(
    `Done in ${Date.now() - started}ms: ${users} users, ${locations} locations, ${products} products.`,
  );
  console.log('Login: manager@stocksense.dev / Manager@123  ·  staff@stocksense.dev / Staff@123');
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
