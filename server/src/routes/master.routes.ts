import { Router } from 'express';
import * as c from '../controllers/master.controller.js';
import { requireRole } from '../middleware/auth.js';

// Mounted behind requireAuth. Everyone can read; only managers can change master data.
const manager = requireRole('MANAGER');

export function warehouseRoutes() {
  const r = Router();
  r.get('/', c.listWarehouses);
  r.get('/:id', c.getWarehouse);
  r.post('/', manager, c.createWarehouse);
  r.patch('/:id', manager, c.updateWarehouse);
  r.delete('/:id', manager, c.deleteWarehouse);
  return r;
}

export function locationRoutes() {
  const r = Router();
  r.get('/', c.listLocations);
  r.get('/tree', c.locationTree);
  r.get('/:id', c.getLocation);
  r.post('/', manager, c.createLocation);
  r.patch('/:id', manager, c.updateLocation);
  r.delete('/:id', manager, c.deleteLocation);
  return r;
}

export function categoryRoutes() {
  const r = Router();
  r.get('/', c.listCategories);
  r.post('/', manager, c.createCategory);
  r.patch('/:id', manager, c.updateCategory);
  r.delete('/:id', manager, c.deleteCategory);
  return r;
}

export function productRoutes() {
  const r = Router();
  r.get('/', c.listProducts);
  r.get('/sku/:sku', c.getProductBySku);
  r.get('/:id', c.getProduct);
  r.get('/:id/stock', c.productStock);
  r.post('/', manager, c.createProduct);
  r.patch('/:id', manager, c.updateProduct);
  r.delete('/:id', manager, c.deleteProduct);
  return r;
}
