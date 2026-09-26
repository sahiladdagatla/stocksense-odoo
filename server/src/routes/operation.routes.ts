import { Router } from 'express';
import * as c from '../controllers/operation.controller.js';

// Mounted behind requireAuth. Both MANAGER and STAFF may run operations and adjustments.
export function operationRoutes() {
  const r = Router();
  r.get('/', c.list);
  r.post('/', c.create);
  r.get('/:id', c.get);
  r.patch('/:id', c.update);
  r.post('/:id/confirm', c.confirm);
  r.post('/:id/validate', c.validate);
  r.post('/:id/cancel', c.cancel);
  r.get('/:id/slip.pdf', c.slip);
  return r;
}

export function adjustmentRoutes() {
  const r = Router();
  r.post('/', c.adjust);
  return r;
}

export function moveRoutes() {
  const r = Router();
  r.get('/', c.listMoves);
  r.get('/export.csv', c.exportMoves);
  r.get('/integrity-check', c.integrity);
  return r;
}
