import { EventEmitter } from 'node:events';
import type { OpType } from '@prisma/client';

/** Emitted after a stock-changing transaction commits. The Socket.io layer relays it to clients. */
export type StockUpdatedEvent = {
  operationId: number;
  reference: string;
  type: OpType;
  productIds: number[];
};

export const events = new EventEmitter();

export const emitStockUpdated = (e: StockUpdatedEvent) => events.emit('stock:updated', e);
