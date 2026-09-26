import { z } from 'zod';
import { positiveQty, qty } from './master.schema.js';

const id = z.coerce.number().int().positive();

export const operationLineInput = z.object({ productId: id, demandQty: positiveQty });

const uniqueProducts = (lines: { productId: number }[]) =>
  new Set(lines.map((l) => l.productId)).size === lines.length;

export const operationCreate = z.object({
  type: z.enum(['RECEIPT', 'DELIVERY', 'INTERNAL']),
  partner: z.string().trim().max(120).nullish(),
  sourceLocId: id.optional(),
  destLocId: id.optional(),
  scheduledDate: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).nullish(),
  lines: z
    .array(operationLineInput)
    .min(1, 'Add at least one product')
    .max(200)
    .refine(uniqueProducts, 'Each product can appear only once'),
});

/** Only DRAFT operations are editable. Lines, when given, replace the existing lines. */
export const operationUpdate = operationCreate
  .omit({ type: true })
  .partial()
  .extend({
    lines: z
      .array(operationLineInput.extend({ doneQty: qty.optional() }))
      .min(1, 'Add at least one product')
      .max(200)
      .refine(uniqueProducts, 'Each product can appear only once')
      .optional(),
  });

export const adjustmentCreate = z.object({
  productId: id,
  locationId: id,
  countedQty: qty,
  reason: z.string().trim().max(200).nullish(),
});

export type OperationCreate = z.infer<typeof operationCreate>;
export type OperationUpdate = z.infer<typeof operationUpdate>;
export type AdjustmentCreate = z.infer<typeof adjustmentCreate>;

const opType = z.enum(['RECEIPT', 'DELIVERY', 'INTERNAL', 'ADJUSTMENT']);
const opStatus = z.enum(['DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED']);
/** Accepts `status=READY` or `status=READY,WAITING`. */
const statusList = z
  .string()
  .transform((s) => s.split(',').map((v) => v.trim().toUpperCase()))
  .pipe(z.array(opStatus).min(1));

export const operationQuery = z.object({
  type: opType.optional(),
  status: statusList.optional(),
  warehouseId: id.optional(),
  categoryId: id.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export const moveQuery = z.object({
  productId: id.optional(),
  locationId: id.optional(),
  type: opType.optional(),
  userId: id.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});

export type OperationQuery = z.infer<typeof operationQuery>;
export type MoveQuery = z.infer<typeof moveQuery>;

export const validateBody = z.object({ createBackorder: z.boolean().optional() }).default({});
