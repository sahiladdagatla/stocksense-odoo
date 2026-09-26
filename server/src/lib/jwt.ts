import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from './env.js';

export type TokenPayload = { sub: string; role: Role };

export function signToken(user: { id: number; role: Role }) {
  const payload: TokenPayload = { sub: String(user.id), role: user.role };
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>,
  });
}

/** Returns the user id from a valid token, or null for any invalid/expired token. */
export function verifyToken(token: string): number | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') return null;
    const id = Number(decoded.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
