import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from './env.js';
import { verifyToken } from './jwt.js';
import { events, type OperationChangedEvent, type StockUpdatedEvent } from './events.js';

/**
 * Real-time channel. Clients authenticate with the same JWT as the REST API
 * (`io(url, { auth: { token } })`) and receive:
 *  - `stock:updated`     after any validated operation or adjustment
 *  - `operation:changed` after a document is created, edited, confirmed or canceled
 */
export function initSocket(server: HttpServer) {
  const io = new Server(server, { cors: { origin: env.CLIENT_ORIGIN, credentials: true } });

  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth.token;
    const userId = typeof token === 'string' ? verifyToken(token) : null;
    if (!userId) return next(new Error('UNAUTHORIZED'));
    socket.data.userId = userId;
    next();
  });

  const onStock = (e: StockUpdatedEvent) => io.emit('stock:updated', e);
  const onOperation = (e: OperationChangedEvent) => io.emit('operation:changed', e);
  events.on('stock:updated', onStock);
  events.on('operation:changed', onOperation);

  return {
    io,
    close: async () => {
      events.off('stock:updated', onStock);
      events.off('operation:changed', onOperation);
      await io.close();
    },
  };
}
