import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as c from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const limited = (limit: number, message: string) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
    },
  });

/** Built per app instance so each app (and each test) gets its own rate-limit counters. */
export function authRoutes() {
  const r = Router();
  const loginLimiter = limited(20, 'Too many sign-in attempts. Try again in 15 minutes.');
  const otpLimiter = limited(5, 'Too many reset requests. Try again in 15 minutes.');

  r.post('/signup', loginLimiter, c.signup);
  r.post('/login', loginLimiter, c.login);
  r.post('/forgot-password', otpLimiter, c.forgotPassword);
  r.post('/reset-password', otpLimiter, c.resetPassword);
  r.get('/me', requireAuth, c.me);
  r.patch('/me', requireAuth, c.updateMe);
  return r;
}
