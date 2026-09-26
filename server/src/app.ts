import express from 'express';
import cors from 'cors';
import { env } from './lib/env.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
