import { prisma } from '../../src/lib/prisma.js';

/** Empties every table in the test database. */
export async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE "StockMove", "OperationLine", "Operation", "StockQuant", "Product", "Category",
             "Location", "Warehouse", "User", "Sequence" RESTART IDENTITY CASCADE
  `);
}

/** Minimal fixture: one user, one warehouse with two internal locations, the three virtual ones, one product. */
export async function createFixture() {
  const user = await prisma.user.create({
    data: { name: 'Test', email: 'test@stocksense.dev', passwordHash: 'x', role: 'MANAGER' },
  });
  const wh = await prisma.warehouse.create({ data: { code: 'WH1', name: 'Main' } });
  const stock = await prisma.location.create({
    data: { name: 'Stock', fullName: 'WH1/Stock', type: 'INTERNAL', warehouseId: wh.id },
  });
  const shelf = await prisma.location.create({
    data: {
      name: 'Shelf',
      fullName: 'WH1/Stock/Shelf',
      type: 'INTERNAL',
      warehouseId: wh.id,
      parentId: stock.id,
    },
  });
  const vendor = await prisma.location.create({
    data: { name: 'Vendors', fullName: 'Virtual/Vendors', type: 'VENDOR' },
  });
  const customer = await prisma.location.create({
    data: { name: 'Customers', fullName: 'Virtual/Customers', type: 'CUSTOMER' },
  });
  const loss = await prisma.location.create({
    data: { name: 'Inventory Loss', fullName: 'Virtual/Inventory Loss', type: 'LOSS' },
  });
  const category = await prisma.category.create({ data: { name: 'Raw Materials' } });
  const product = await prisma.product.create({
    data: { name: 'Steel Rods', sku: 'STL-1', uom: 'kg', categoryId: category.id },
  });
  return { user, wh, stock, shelf, vendor, customer, loss, category, product };
}
