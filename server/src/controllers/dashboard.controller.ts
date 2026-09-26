import type { Request, Response } from 'express';
import { parse } from '../lib/validate.js';
import { dashboardQuery } from '../schemas/dashboard.schema.js';
import * as dashboard from '../services/dashboard.service.js';

export async function kpis(req: Request, res: Response) {
  res.json(await dashboard.kpis(parse(dashboardQuery, req.query)));
}

export async function movementChart(req: Request, res: Response) {
  res.json(await dashboard.movementChart(parse(dashboardQuery, req.query)));
}

export async function reorder(req: Request, res: Response) {
  res.json(await dashboard.reorderList(parse(dashboardQuery, req.query)));
}
