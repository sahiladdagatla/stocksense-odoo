import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

type ErrorBody = { error: { code: string; message: string; details?: unknown } };

function formatZod(err: ZodError) {
  const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  const first = details[0];
  const message = first
    ? first.path
      ? `${first.path}: ${first.message}`
      : first.message
    : 'Invalid input';
  return { message, details };
}

function fromPrisma(err: Prisma.PrismaClientKnownRequestError): [number, ErrorBody] {
  switch (err.code) {
    case 'P2002': {
      const target = (err.meta?.target as string[] | string | undefined) ?? 'field';
      const fields = Array.isArray(target) ? target.join(', ') : target;
      return [
        409,
        { error: { code: 'CONFLICT', message: `A record with this ${fields} already exists` } },
      ];
    }
    case 'P2003':
      return [
        409,
        {
          error: {
            code: 'IN_USE',
            message: 'This record is referenced by other data and cannot be changed',
          },
        },
      ];
    case 'P2025':
      return [404, { error: { code: 'NOT_FOUND', message: 'Record not found' } }];
    default:
      // ON DELETE RESTRICT raises SQLSTATE 23001, which Prisma reports without a P2003 code.
      if (/23001|RESTRICT|foreign key/i.test(err.message)) {
        return [
          409,
          {
            error: {
              code: 'IN_USE',
              message: 'This record is referenced by other data and cannot be changed',
            },
          },
        ];
      }
      return [500, { error: { code: 'DATABASE_ERROR', message: 'A database error occurred' } }];
  }
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
};

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    const { message, details } = formatZod(err);
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message, details } });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const [status, body] = fromPrisma(err);
    if (status === 500) console.error(err);
    res.status(status).json(body);
    return;
  }
  // Malformed JSON body from express.json().
  if (err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
