import { z } from 'zod';

export const dashboardQuery = z.object({
  warehouseId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  /** Client's Date#getTimezoneOffset(), in minutes. */
  tzOffset: z.coerce.number().int().min(-840).max(840).optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuery>;
