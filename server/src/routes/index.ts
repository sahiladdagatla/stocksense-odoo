import { Router } from 'express';
import { authRoutes } from './auth.routes.js';

export function apiRoutes() {
  const api = Router();

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  api.use('/auth', authRoutes());

  return api;
}
