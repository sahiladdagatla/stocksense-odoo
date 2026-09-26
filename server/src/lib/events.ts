import { EventEmitter } from 'node:events';
import type { OpStatus, OpType } from '@prisma/client';

/** Emitted after a stock-changing transaction commits. The Socket.io layer relays it to clients. */
export type StockUpdatedEvent = {
  operationId: number;
  reference: string;
  type: OpType;
  productIds: number[];
};

/** Emitted when a document changes without moving stock (create, edit, confirm, cancel). */
export type OperationChangedEvent = { operationId: number; type: OpType; status: OpStatus };

export const events = new EventEmitter();

export const emitStockUpdated = (e: StockUpdatedEvent) => events.emit('stock:updated', e);
export const emitOperationChanged = (op: { id: number; type: OpType; status: OpStatus }) =>
  events.emit('operation:changed', { operationId: op.id, type: op.type, status: op.status });
