import type { Request, Response } from 'express';
import { parse } from '../lib/validate.js';
import { currentUser } from '../middleware/auth.js';
import * as auth from '../services/auth.service.js';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateMeSchema,
} from '../schemas/auth.schema.js';

export async function signup(req: Request, res: Response) {
  res.status(201).json(await auth.signup(parse(signupSchema, req.body)));
}

export async function login(req: Request, res: Response) {
  res.json(await auth.login(parse(loginSchema, req.body)));
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = parse(forgotPasswordSchema, req.body);
  await auth.requestPasswordReset(email);
  res.json({ message: 'If an account exists for this email, a 6-digit code has been sent.' });
}

export async function resetPassword(req: Request, res: Response) {
  await auth.resetPassword(parse(resetPasswordSchema, req.body));
  res.json({ message: 'Password updated. You can now sign in.' });
}

export async function me(req: Request, res: Response) {
  res.json(await auth.getMe(currentUser(req).id));
}

export async function updateMe(req: Request, res: Response) {
  res.json(await auth.updateMe(currentUser(req).id, parse(updateMeSchema, req.body)));
}

export async function myStats(req: Request, res: Response) {
  res.json(await auth.myStats(currentUser(req).id));
}
