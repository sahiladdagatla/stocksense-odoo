import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './lib/env.js';
import { apiRoutes } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  // Rate limiting keys on client IP; trust the first proxy hop (e.g. Vite dev proxy, a load balancer).
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRoutes());
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
