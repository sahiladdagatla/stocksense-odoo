import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { authRoutes } from './auth.routes.js';
import { categoryRoutes, locationRoutes, productRoutes, warehouseRoutes } from './master.routes.js';

export function apiRoutes() {
  const api = Router();

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  api.use('/auth', authRoutes());

  api.use('/warehouses', requireAuth, warehouseRoutes());
  api.use('/locations', requireAuth, locationRoutes());
  api.use('/categories', requireAuth, categoryRoutes());
  api.use('/products', requireAuth, productRoutes());

  return api;
}
