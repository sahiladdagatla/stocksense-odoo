import type { StockStatus } from './types';

export const STOCK_LABEL: Record<StockStatus, string> = {
  IN_STOCK: 'In stock',
  LOW: 'Low stock',
  OUT: 'Out of stock',
};

/** Text colour for a quantity given its stock status. */
export const stockTone: Record<StockStatus, string> = {
  IN_STOCK: 'text-ink',
  LOW: 'text-warning',
  OUT: 'text-danger',
};
