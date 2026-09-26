import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';

export const listCategories = () =>
  prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });

async function ensure(id: number) {
  if (!(await prisma.category.findUnique({ where: { id } }))) throw notFound('Category not found');
}

export const createCategory = (name: string) => prisma.category.create({ data: { name } });

export async function updateCategory(id: number, name: string) {
  await ensure(id);
  return prisma.category.update({ where: { id }, data: { name } });
}

export async function deleteCategory(id: number) {
  await ensure(id);
  if (await prisma.product.count({ where: { categoryId: id } })) {
    throw conflict('Move or delete this category’s products first', 'CATEGORY_IN_USE');
  }
  await prisma.category.delete({ where: { id } });
}
