import { Router } from 'express';
import * as c from '../controllers/dashboard.controller.js';

export function dashboardRoutes() {
  const r = Router();
  r.get('/kpis', c.kpis);
  r.get('/movement-chart', c.movementChart);
  r.get('/reorder', c.reorder);
  return r;
}
