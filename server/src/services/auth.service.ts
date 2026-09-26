import { randomInt } from 'node:crypto';
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashSecret, verifySecret } from '../lib/password.js';
import { signToken } from '../lib/jwt.js';
import { badRequest, conflict, unauthorized, AppError } from '../lib/errors.js';
import { sendOtpEmail } from './mail.service.js';
import type {
  LoginInput,
  ResetPasswordInput,
  SignupInput,
  UpdateMeInput,
} from '../schemas/auth.schema.js';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
/** Minimum gap between two OTP emails to the same account. */
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

/** Compared against when the email is unknown, so response timing doesn't reveal which accounts exist. */
const dummyHash = hashSecret('stocksense-timing-equaliser');

export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'active' | 'createdAt'>;

export const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  createdAt: u.createdAt,
});

const session = (user: User) => ({ token: signToken(user), user: toPublicUser(user) });

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict('An account with this email already exists', 'EMAIL_TAKEN');

  // Public signup always creates STAFF; managers are provisioned by an administrator (seed).
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashSecret(input.password),
      role: 'STAFF',
    },
  });
  return session(user);
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = await verifySecret(input.password, user?.passwordHash ?? (await dummyHash));
  if (!user || !ok) throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  if (!user.active) {
    throw unauthorized('This account has been deactivated. Contact a manager.', 'ACCOUNT_DISABLED');
  }
  return session(user);
}

/**
 * Issues a 6-digit OTP. Always resolves the same way whether or not the email exists,
 * so the endpoint can't be used to discover accounts.
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.active) return;

  const now = Date.now();
  const issuedAt = user.otpExpiry ? user.otpExpiry.getTime() - OTP_TTL_MS : 0;
  if (now - issuedAt < OTP_RESEND_COOLDOWN_MS) return; // silently throttle resends

  const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.user.update({
    where: { id: user.id },
    data: { otpHash: await hashSecret(otp), otpExpiry: new Date(now + OTP_TTL_MS), otpAttempts: 0 },
  });
  await sendOtpEmail(user.email, user.name, otp);
}

export async function resetPassword(input: ResetPasswordInput) {
  const invalid = () => badRequest('Invalid or expired code', 'INVALID_OTP');
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user?.otpHash || !user.otpExpiry || user.otpExpiry.getTime() < Date.now()) throw invalid();
  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError(429, 'OTP_LOCKED', 'Too many wrong attempts. Request a new code.');
  }

  if (!(await verifySecret(input.otp, user.otpHash))) {
    await prisma.user.update({
      where: { id: user.id },
      data: { otpAttempts: { increment: 1 } },
    });
    throw invalid();
  }

  // Clearing the OTP in the same update makes it single-use.
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashSecret(input.newPassword),
      otpHash: null,
      otpExpiry: null,
      otpAttempts: 0,
    },
  });
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return toPublicUser(user);
}

export async function updateMe(userId: number, input: UpdateMeInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  let passwordHash: string | undefined;
  if (input.newPassword) {
    if (!input.currentPassword || !(await verifySecret(input.currentPassword, user.passwordHash))) {
      throw badRequest('Current password is incorrect', 'WRONG_PASSWORD');
    }
    passwordHash = await hashSecret(input.newPassword);
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name: input.name, passwordHash },
  });
  return toPublicUser(updated);
}

/** Activity counters for the profile page, derived from the ledger. */
export async function myStats(userId: number) {
  const [validated, adjustments, lastMove] = await Promise.all([
    prisma.operation.count({
      where: { status: 'DONE', type: { not: 'ADJUSTMENT' }, moves: { some: { userId } } },
    }),
    prisma.operation.count({
      where: { status: 'DONE', type: 'ADJUSTMENT', moves: { some: { userId } } },
    }),
    prisma.stockMove.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  return {
    operationsValidated: validated,
    adjustmentsLogged: adjustments,
    lastActivityAt: lastMove?.createdAt ?? null,
  };
}
