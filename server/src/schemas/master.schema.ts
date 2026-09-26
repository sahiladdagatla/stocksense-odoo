import { z } from 'zod';

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const optionalId = z.coerce.number().int().positive().optional();
const text = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
/** Non-negative quantity with at most 3 decimals (matches Decimal(14,3)). */
export const qty = z.coerce
  .number()
  .nonnegative()
  .max(99_999_999_999)
  .refine((n) => Math.abs(Math.round(n * 1000) - n * 1000) < 1e-6, 'At most 3 decimals');
export const positiveQty = qty.refine((n) => n > 0, 'Quantity must be greater than 0');

// Warehouses
export const warehouseCreate = z.object({
  name: text(80),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,8}$/, 'Code must be 2–8 letters or digits'),
  address: nullableText(200),
});
// Code is immutable: it prefixes every location path and document reference.
export const warehouseUpdate = warehouseCreate.omit({ code: true }).partial();

// Locations
export const locationCreate = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .refine((s) => !s.includes('/'), 'Name cannot contain "/"'),
  warehouseId: z.coerce.number().int().positive(),
  parentId: z.coerce.number().int().positive().nullish(),
});
export const locationUpdate = locationCreate.pick({ name: true });
export const locationQuery = z.object({
  warehouseId: optionalId,
  includeVirtual: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

// Categories
export const categoryBody = z.object({ name: text(60) });

// Products
export const productCreate = z.object({
  name: text(120),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9._-]{1,39}$/, 'SKU: 2–40 letters, digits, ".", "_" or "-"'),
  uom: text(20),
  categoryId: z.coerce.number().int().positive(),
  reorderMin: qty.default(0),
  reorderQty: qty.default(0),
  /** Optional opening stock, booked as an inventory adjustment so it appears in the ledger. */
  initialQty: qty.optional(),
  initialLocationId: optionalId,
});
export const productUpdate = z
  .object({
    name: text(120),
    sku: productCreate.shape.sku,
    uom: text(20),
    categoryId: z.coerce.number().int().positive(),
    reorderMin: qty,
    reorderQty: qty,
  })
  .partial();
export const productQuery = pageQuery.extend({
  search: z.string().trim().max(100).optional(),
  categoryId: optionalId,
});

export type ProductCreate = z.infer<typeof productCreate>;
export type ProductUpdate = z.infer<typeof productUpdate>;
export type ProductQuery = z.infer<typeof productQuery>;
