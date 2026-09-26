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
