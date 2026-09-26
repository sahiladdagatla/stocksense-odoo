import type { Request, Response } from 'express';
import { parse } from '../lib/validate.js';
import { currentUser } from '../middleware/auth.js';
import * as wh from '../services/warehouse.service.js';
import * as loc from '../services/location.service.js';
import * as cat from '../services/category.service.js';
import * as prod from '../services/product.service.js';
import {
  categoryBody,
  idParam,
  locationCreate,
  locationQuery,
  locationUpdate,
  productCreate,
  productQuery,
  productUpdate,
  warehouseCreate,
  warehouseUpdate,
} from '../schemas/master.schema.js';

const id = (req: Request) => parse(idParam, req.params).id;

// Warehouses
export const listWarehouses = async (_req: Request, res: Response) => {
  res.json(await wh.listWarehouses());
};
export const getWarehouse = async (req: Request, res: Response) => {
  res.json(await wh.getWarehouse(id(req)));
};
export const createWarehouse = async (req: Request, res: Response) => {
  res.status(201).json(await wh.createWarehouse(parse(warehouseCreate, req.body)));
};
export const updateWarehouse = async (req: Request, res: Response) => {
  res.json(await wh.updateWarehouse(id(req), parse(warehouseUpdate, req.body)));
};
export const deleteWarehouse = async (req: Request, res: Response) => {
  await wh.deleteWarehouse(id(req));
  res.status(204).end();
};

// Locations
export const listLocations = async (req: Request, res: Response) => {
  res.json(await loc.listLocations(parse(locationQuery, req.query)));
};
export const locationTree = async (_req: Request, res: Response) => {
  res.json(await loc.locationTree());
};
export const getLocation = async (req: Request, res: Response) => {
  res.json(await loc.getLocation(id(req)));
};
export const createLocation = async (req: Request, res: Response) => {
  res.status(201).json(await loc.createLocation(parse(locationCreate, req.body)));
};
export const updateLocation = async (req: Request, res: Response) => {
  res.json(await loc.renameLocation(id(req), parse(locationUpdate, req.body).name));
};
export const deleteLocation = async (req: Request, res: Response) => {
  await loc.deleteLocation(id(req));
  res.status(204).end();
};

// Categories
export const listCategories = async (_req: Request, res: Response) => {
  res.json(await cat.listCategories());
};
export const createCategory = async (req: Request, res: Response) => {
  res.status(201).json(await cat.createCategory(parse(categoryBody, req.body).name));
};
export const updateCategory = async (req: Request, res: Response) => {
  res.json(await cat.updateCategory(id(req), parse(categoryBody, req.body).name));
};
export const deleteCategory = async (req: Request, res: Response) => {
  await cat.deleteCategory(id(req));
  res.status(204).end();
};

// Products
export const listProducts = async (req: Request, res: Response) => {
  res.json(await prod.listProducts(parse(productQuery, req.query)));
};
export const getProductBySku = async (req: Request, res: Response) => {
  res.json(await prod.getProductBySku(String(req.params.sku)));
};
export const getProduct = async (req: Request, res: Response) => {
  res.json(await prod.getProduct(id(req)));
};
export const productStock = async (req: Request, res: Response) => {
  res.json(await prod.productStock(id(req)));
};
export const createProduct = async (req: Request, res: Response) => {
  res
    .status(201)
    .json(await prod.createProduct(parse(productCreate, req.body), currentUser(req).id));
};
export const updateProduct = async (req: Request, res: Response) => {
  res.json(await prod.updateProduct(id(req), parse(productUpdate, req.body)));
};
export const deleteProduct = async (req: Request, res: Response) => {
  await prod.deleteProduct(id(req));
  res.status(204).end();
};
