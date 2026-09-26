import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { hashSecret } from '../src/lib/password.js';
import { requireAuth, requireRole } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/error.js';
import { resetDb } from './helpers/db.js';

const sentOtps = vi.hoisted(() => [] as { email: string; otp: string }[]);
vi.mock('../src/services/mail.service.js', () => ({
  sendOtpEmail: vi.fn(async (email: string, _name: string, otp: string) => {
    sentOtps.push({ email, otp });
  }),
}));

let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDb();
  sentOtps.length = 0;
  app = createApp(); // fresh rate-limit counters per test
});
afterAll(() => prisma.$disconnect());

const signup = (body: object) => request(app).post('/api/auth/signup').send(body);
const login = (email: string, password: string) =>
  request(app).post('/api/auth/login').send({ email, password });

describe('signup & login', () => {
  it('signs up as STAFF, returns a token, and /me works with it', async () => {
    const res = await signup({ name: 'Ann', email: 'Ann@Example.com ', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'ann@example.com', role: 'STAFF' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('ann@example.com');
  });

  it('ignores a role sent by the client', async () => {
    const res = await signup({
      name: 'Eve',
      email: 'eve@x.com',
      password: 'secret123',
      role: 'MANAGER',
    });
    expect(res.body.user.role).toBe('STAFF');
  });

  it('stores the password as a bcrypt hash', async () => {
    await signup({ name: 'Ann', email: 'ann@x.com', password: 'secret123' });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ann@x.com' } });
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user.passwordHash).not.toContain('secret123');
  });

  it('rejects duplicate emails with 409', async () => {
    await signup({ name: 'Ann', email: 'ann@x.com', password: 'secret123' });
    const res = await signup({ name: 'Ann 2', email: 'ANN@x.com', password: 'secret123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates input with a readable message', async () => {
    const res = await signup({ name: 'A', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('logs in with correct credentials and rejects wrong ones generically', async () => {
    await signup({ name: 'Ann', email: 'ann@x.com', password: 'secret123' });
    expect((await login('ann@x.com', 'secret123')).status).toBe(200);

    const wrongPw = await login('ann@x.com', 'wrong-pass1');
    const noUser = await login('ghost@x.com', 'secret123');
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body).toEqual(noUser.body);
  });

  it('rejects missing, malformed and forged tokens', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('profile', () => {
  it('updates name and changes password only with the current password', async () => {
    const { body } = await signup({ name: 'Ann', email: 'ann@x.com', password: 'secret123' });
    const auth = { Authorization: `Bearer ${body.token}` };

    const renamed = await request(app).patch('/api/auth/me').set(auth).send({ name: 'Annie' });
    expect(renamed.body.name).toBe('Annie');

    const noCurrent = await request(app)
      .patch('/api/auth/me')
      .set(auth)
      .send({ newPassword: 'newpass123' });
    expect(noCurrent.status).toBe(400);

    const wrong = await request(app)
      .patch('/api/auth/me')
      .set(auth)
      .send({ currentPassword: 'nope', newPassword: 'newpass123' });
    expect(wrong.body.error.code).toBe('WRONG_PASSWORD');

    const ok = await request(app)
      .patch('/api/auth/me')
      .set(auth)
      .send({ currentPassword: 'secret123', newPassword: 'newpass123' });
    expect(ok.status).toBe(200);
    expect((await login('ann@x.com', 'newpass123')).status).toBe(200);
  });
});

describe('password reset via OTP', () => {
  beforeEach(async () => {
    await signup({ name: 'Ann', email: 'ann@x.com', password: 'secret123' });
  });

  const forgot = (email: string) => request(app).post('/api/auth/forgot-password').send({ email });
  const reset = (otp: string, newPassword = 'brandnew123') =>
    request(app).post('/api/auth/reset-password').send({ email: 'ann@x.com', otp, newPassword });

  it('sends a 6-digit OTP, stores only its hash, and resets the password once', async () => {
    expect((await forgot('ann@x.com')).status).toBe(200);
    expect(sentOtps).toHaveLength(1);
    const otp = sentOtps[0]!.otp;
    expect(otp).toMatch(/^\d{6}$/);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'ann@x.com' } });
    expect(user.otpHash).toMatch(/^\$2[aby]\$/);
    expect(user.otpExpiry!.getTime() - Date.now()).toBeGreaterThan(9 * 60 * 1000);

    expect((await reset(otp)).status).toBe(200);
    expect((await login('ann@x.com', 'brandnew123')).status).toBe(200);
    expect((await reset(otp, 'another123')).body.error.code).toBe('INVALID_OTP'); // single use
  });

  it('responds identically for unknown emails and sends nothing', async () => {
    const known = await forgot('ann@x.com');
    const unknown = await forgot('ghost@x.com');
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
    expect(sentOtps.map((s) => s.email)).toEqual(['ann@x.com']);
  });

  it('rejects expired OTPs', async () => {
    await forgot('ann@x.com');
    await prisma.user.update({
      where: { email: 'ann@x.com' },
      data: { otpExpiry: new Date(Date.now() - 1000) },
    });
    expect((await reset(sentOtps[0]!.otp)).body.error.code).toBe('INVALID_OTP');
  });

  it('locks the OTP after 5 wrong attempts', async () => {
    // Set the OTP directly so the per-IP rate limiter isn't what stops us.
    await prisma.user.update({
      where: { email: 'ann@x.com' },
      data: {
        otpHash: await hashSecret('123456'),
        otpExpiry: new Date(Date.now() + 600_000),
        otpAttempts: 5,
      },
    });
    const res = await reset('123456');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('OTP_LOCKED');
  });

  it('rate-limits the reset endpoints per IP', async () => {
    for (let i = 0; i < 5; i++) await forgot('ann@x.com');
    const res = await forgot('ann@x.com');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(sentOtps).toHaveLength(1); // resend cooldown also applied
  });
});

describe('role middleware', () => {
  const guarded = express();
  guarded.get('/manager-only', requireAuth, requireRole('MANAGER'), (_req, res) => {
    res.json({ ok: true });
  });
  guarded.use(errorHandler);

  it('lets managers through and returns 403 for staff', async () => {
    const staff = (await signup({ name: 'Sam', email: 'sam@x.com', password: 'secret123' })).body;
    await prisma.user.create({
      data: {
        name: 'Maya',
        email: 'maya@x.com',
        role: 'MANAGER',
        passwordHash: await hashSecret('secret123'),
      },
    });
    const manager = (await login('maya@x.com', 'secret123')).body;

    const asStaff = await request(guarded)
      .get('/manager-only')
      .set('Authorization', `Bearer ${staff.token}`);
    expect(asStaff.status).toBe(403);
    expect(asStaff.body.error.code).toBe('FORBIDDEN');

    const asManager = await request(guarded)
      .get('/manager-only')
      .set('Authorization', `Bearer ${manager.token}`);
    expect(asManager.status).toBe(200);
  });
});

describe('error envelope', () => {
  it('returns { error: { code, message } } for unknown routes and bad JSON', async () => {
    const missing = await request(app).get('/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    const badJson = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(badJson.status).toBe(400);
    expect(badJson.body.error.code).toBe('INVALID_JSON');
  });
});
