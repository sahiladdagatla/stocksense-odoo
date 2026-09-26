import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { hashSecret } from '../src/lib/password.js';
import { authHeaders, resetDb } from './helpers/db.js';

const app = createApp();
let h: Awaited<ReturnType<typeof authHeaders>>;
let staffId: number;

beforeEach(async () => {
  await resetDb();
  h = await authHeaders();
  staffId = (await prisma.user.findUniqueOrThrow({ where: { email: 's@x.com' } })).id;
});
afterAll(() => prisma.$disconnect());

const api = () => request(app);

describe('user management', () => {
  it('lists users for everyone, with activity counts', async () => {
    const res = await api().get('/api/users').set(h.staff);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ active: true, movesRecorded: 0, lastActivityAt: null });
    expect(res.body[0].passwordHash).toBeUndefined();
  });

  it('lets a manager promote staff, and the new role applies immediately', async () => {
    const res = await api().patch(`/api/users/${staffId}`).set(h.manager).send({ role: 'MANAGER' });
    expect(res.body.role).toBe('MANAGER');
    // The same (old) token now passes manager-only routes: roles are re-read per request.
    const cat = await api().post('/api/categories').set(h.staff).send({ name: 'Promoted' });
    expect(cat.status).toBe(201);
  });

  it('staff cannot change users', async () => {
    const res = await api()
      .patch(`/api/users/${h.managerUser.id}`)
      .set(h.staff)
      .send({ role: 'STAFF' });
    expect(res.status).toBe(403);
  });

  it('managers cannot change their own account', async () => {
    const res = await api()
      .patch(`/api/users/${h.managerUser.id}`)
      .set(h.manager)
      .send({ active: false });
    expect(res.body.error.code).toBe('SELF_CHANGE');
  });

  it('a manager can demote another manager; the acting manager always remains', async () => {
    const other = await prisma.user.create({
      data: { name: 'M2', email: 'm2@x.com', role: 'MANAGER', passwordHash: 'x' },
    });
    const res = await api().patch(`/api/users/${other.id}`).set(h.manager).send({ role: 'STAFF' });
    expect(res.body.role).toBe('STAFF');
    const managers = await prisma.user.count({ where: { role: 'MANAGER', active: true } });
    expect(managers).toBe(1);
  });

  it('deactivated users cannot sign in or use existing sessions, and get no reset codes', async () => {
    await prisma.user.update({
      where: { id: staffId },
      data: { passwordHash: await hashSecret('secret123') },
    });
    await api().patch(`/api/users/${staffId}`).set(h.manager).send({ active: false });

    const login = await api()
      .post('/api/auth/login')
      .send({ email: 's@x.com', password: 'secret123' });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('ACCOUNT_DISABLED');

    const session = await api().get('/api/auth/me').set(h.staff);
    expect(session.body.error.code).toBe('ACCOUNT_DISABLED');

    await api().post('/api/auth/forgot-password').send({ email: 's@x.com' });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: staffId } });
    expect(user.otpHash).toBeNull();

    await api().patch(`/api/users/${staffId}`).set(h.manager).send({ active: true });
    expect(
      (await api().post('/api/auth/login').send({ email: 's@x.com', password: 'secret123' }))
        .status,
    ).toBe(200);
  });
});
