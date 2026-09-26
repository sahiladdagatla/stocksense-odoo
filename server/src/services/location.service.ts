import type { Location, Prisma } from '@prisma/client';
import { prisma, type Db } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';

export async function listLocations(opts: { warehouseId?: number; includeVirtual: boolean }) {
  const where: Prisma.LocationWhereInput = opts.includeVirtual ? {} : { type: 'INTERNAL' };
  if (opts.warehouseId) where.warehouseId = opts.warehouseId;
  return prisma.location.findMany({
    where,
    orderBy: { fullName: 'asc' },
    include: { warehouse: { select: { id: true, code: true, name: true } } },
  });
}

type TreeNode = Location & { children: TreeNode[] };

/** Warehouses, each with its internal locations nested by parent. */
export async function locationTree() {
  const [warehouses, locations] = await Promise.all([
    prisma.warehouse.findMany({ orderBy: { code: 'asc' } }),
    prisma.location.findMany({ where: { type: 'INTERNAL' }, orderBy: { fullName: 'asc' } }),
  ]);
  const nodes = new Map<number, TreeNode>(locations.map((l) => [l.id, { ...l, children: [] }]));
  const roots = new Map<number, TreeNode[]>(warehouses.map((w) => [w.id, []]));
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else if (node.warehouseId) roots.get(node.warehouseId)?.push(node);
  }
  return warehouses.map((w) => ({ ...w, locations: roots.get(w.id) ?? [] }));
}

export async function getLocation(id: number) {
  const loc = await prisma.location.findUnique({ where: { id } });
  if (!loc) throw notFound('Location not found');
  return loc;
}

async function getInternal(id: number) {
  const loc = await getLocation(id);
  if (loc.type !== 'INTERNAL')
    throw badRequest('Virtual locations cannot be changed', 'VIRTUAL_LOCATION');
  return loc;
}

export async function createLocation(input: {
  name: string;
  warehouseId: number;
  parentId?: number | null;
}) {
  const wh = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
  if (!wh) throw notFound('Warehouse not found');
  let prefix = wh.code;
  if (input.parentId) {
    const parent = await getInternal(input.parentId);
    if (parent.warehouseId !== wh.id) {
      throw badRequest('Parent location belongs to another warehouse');
    }
    prefix = parent.fullName;
  }
  return prisma.location.create({
    data: {
      name: input.name,
      fullName: `${prefix}/${input.name}`,
      type: 'INTERNAL',
      warehouseId: wh.id,
      parentId: input.parentId ?? null,
    },
  });
}

/** Renames a location and rewrites the path of all its descendants in one transaction. */
export async function renameLocation(id: number, name: string) {
  const loc = await getInternal(id);
  const oldPath = loc.fullName;
  const newPath = `${oldPath.slice(0, oldPath.length - loc.name.length)}${name}`;
  if (newPath === oldPath) return loc;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.location.update({ where: { id }, data: { name, fullName: newPath } });
    await tx.$executeRaw`
      UPDATE "Location" SET "fullName" = ${newPath}::text || substr("fullName", ${oldPath.length + 1}::int)
      WHERE "fullName" LIKE ${oldPath.replace(/[\\%_]/g, '\\$&') + '/%'}
    `;
    return updated;
  });
}

export async function deleteLocation(id: number) {
  await getInternal(id);
  const [children, stocked] = await Promise.all([
    prisma.location.count({ where: { parentId: id } }),
    prisma.stockQuant.count({ where: { locationId: id, quantity: { gt: 0 } } }),
  ]);
  if (children) throw conflict('Delete or move its sub-locations first', 'LOCATION_HAS_CHILDREN');
  if (stocked) throw conflict('This location still holds stock', 'LOCATION_HAS_STOCK');
  // Empty quants are just cache rows; operations/moves referencing it make the delete fail with IN_USE.
  await prisma.$transaction([
    prisma.stockQuant.deleteMany({ where: { locationId: id } }),
    prisma.location.delete({ where: { id } }),
  ]);
}

/** The single virtual location of a type (Vendors / Customers / Inventory Loss). */
export async function virtualLocation(db: Db, type: 'VENDOR' | 'CUSTOMER' | 'LOSS') {
  const loc = await db.location.findFirst({ where: { type }, orderBy: { id: 'asc' } });
  if (!loc) throw new Error(`Virtual ${type} location is missing. Run the seed.`);
  return loc;
}
