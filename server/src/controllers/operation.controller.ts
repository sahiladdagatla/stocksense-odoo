import type { Request, Response } from 'express';
import { parse } from '../lib/validate.js';
import { currentUser } from '../middleware/auth.js';
import { idParam } from '../schemas/master.schema.js';
import {
  adjustmentCreate,
  moveQuery,
  operationCreate,
  operationQuery,
  operationUpdate,
} from '../schemas/operation.schema.js';
import * as lifecycle from '../services/operation.service.js';
import * as docs from '../services/operation-doc.service.js';
import * as stock from '../services/stock.service.js';
import * as moves from '../services/move.service.js';
import { deliverySlip } from '../services/slip.service.js';

const id = (req: Request) => parse(idParam, req.params).id;

// Operations
export async function list(req: Request, res: Response) {
  res.json(await docs.listOperations(parse(operationQuery, req.query)));
}
export async function counts(req: Request, res: Response) {
  res.json(await docs.operationCounts(parse(operationQuery, req.query)));
}
export async function get(req: Request, res: Response) {
  res.json(await docs.getOperation(id(req)));
}
export async function create(req: Request, res: Response) {
  const op = await lifecycle.createOperation(parse(operationCreate, req.body), currentUser(req).id);
  res.status(201).json(await docs.getOperation(op.id));
}
export async function update(req: Request, res: Response) {
  res.json(await docs.updateOperation(id(req), parse(operationUpdate, req.body)));
}
export async function confirm(req: Request, res: Response) {
  await lifecycle.confirmOperation(id(req));
  res.json(await docs.getOperation(id(req)));
}
export async function validate(req: Request, res: Response) {
  await stock.validateOperation(id(req), currentUser(req).id);
  res.json(await docs.getOperation(id(req)));
}
export async function cancel(req: Request, res: Response) {
  await lifecycle.cancelOperation(id(req));
  res.json(await docs.getOperation(id(req)));
}
export async function slip(req: Request, res: Response) {
  const { reference, pdf } = await deliverySlip(id(req));
  res
    .type('application/pdf')
    .setHeader('Content-Disposition', `inline; filename="${reference.replace(/\//g, '-')}.pdf"`)
    .send(pdf);
}

// Adjustments
export async function adjust(req: Request, res: Response) {
  const result = await stock.adjustStock(parse(adjustmentCreate, req.body), currentUser(req).id);
  res.status(result.operation ? 201 : 200).json({
    ...result,
    message: result.operation ? `Adjusted by ${result.difference}` : 'No change',
  });
}

// Moves
export async function listMoves(req: Request, res: Response) {
  res.json(await moves.listMoves(parse(moveQuery, req.query)));
}
export async function exportMoves(req: Request, res: Response) {
  const csv = await moves.exportMovesCsv(parse(moveQuery, req.query));
  const stamp = new Date().toISOString().slice(0, 10);
  res
    .type('text/csv')
    .setHeader('Content-Disposition', `attachment; filename="stock-moves-${stamp}.csv"`)
    .send(csv);
}
export async function integrity(_req: Request, res: Response) {
  res.json(await stock.integrityCheck());
}
