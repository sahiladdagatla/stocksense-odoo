import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';

export const listWarehouses = () =>
  prisma.warehouse.findMany({
    orderBy: { code: 'asc' },
    include: { _count: { select: { locations: true } } },
  });

export async function getWarehouse(id: number) {
  const wh = await prisma.warehouse.findUnique({ where: { id } });
  if (!wh) throw notFound('Warehouse not found');
  return wh;
}

export async function createWarehouse(data: {
  name: string;
  code: string;
  address: string | null;
}) {
  return prisma.warehouse.create({ data });
}

export async function updateWarehouse(
  id: number,
  data: { name?: string; address?: string | null },
) {
  await getWarehouse(id);
  return prisma.warehouse.update({ where: { id }, data });
}

export async function deleteWarehouse(id: number) {
  await getWarehouse(id);
  const locations = await prisma.location.count({ where: { warehouseId: id } });
  if (locations > 0) {
    throw conflict('Delete this warehouse’s locations first', 'WAREHOUSE_NOT_EMPTY');
  }
  await prisma.warehouse.delete({ where: { id } });
}
