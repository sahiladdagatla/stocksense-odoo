import type { Request, RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../lib/jwt.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export type AuthUser = { id: number; name: string; email: string; role: Role };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Verifies the Bearer JWT and loads the user. The user is re-read from the DB on every request,
 * so deleted users and role changes take effect immediately rather than when the token expires.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) throw unauthorized();

  const userId = verifyToken(token);
  if (!userId)
    throw unauthorized('Session expired or invalid. Please sign in again.', 'INVALID_TOKEN');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user) throw unauthorized('Account no longer exists', 'INVALID_TOKEN');
  if (!user.active) throw unauthorized('This account has been deactivated', 'ACCOUNT_DISABLED');

  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) {
      throw forbidden(`This action requires the ${roles.join(' or ')} role`);
    }
    next();
  };

/** The authenticated user. Only call from handlers mounted behind `requireAuth`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
