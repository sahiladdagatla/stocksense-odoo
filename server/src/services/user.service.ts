import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';

/** Everyone in the organisation with their ledger activity (used by admin and operator filters). */
export async function listUsers() {
  const [users, activity] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),
    prisma.stockMove.groupBy({ by: ['userId'], _count: true, _max: { createdAt: true } }),
  ]);
  const byUser = new Map(activity.map((a) => [a.userId, a]));
  return users.map((u) => ({
    ...u,
    movesRecorded: byUser.get(u.id)?._count ?? 0,
    lastActivityAt: byUser.get(u.id)?._max.createdAt ?? null,
  }));
}

/**
 * Changes a user's role or active flag. Managers cannot change their own account, which already
 * guarantees an active manager always remains (the actor); the explicit last-manager check below
 * is defence in depth in case that rule is ever relaxed.
 */
export async function updateUser(
  actorId: number,
  id: number,
  input: { role?: Role; active?: boolean },
) {
  if (actorId === id) {
    throw badRequest('You cannot change your own role or status', 'SELF_CHANGE');
  }
  return prisma.$transaction(async (tx) => {
    // Serialise concurrent role changes so two managers can't demote each other at once.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242)`;
    const user = await tx.user.findUnique({ where: { id } });
    if (!user) throw notFound('User not found');

    const losesManager =
      user.role === 'MANAGER' && user.active && (input.role === 'STAFF' || input.active === false);
    if (losesManager) {
      const others = await tx.user.count({
        where: { role: 'MANAGER', active: true, id: { not: id } },
      });
      if (others === 0) throw conflict('At least one active manager is required', 'LAST_MANAGER');
    }

    return tx.user.update({
      where: { id },
      data: {
        role: input.role,
        active: input.active,
        // Deactivation also voids any pending password-reset code.
        ...(input.active === false && { otpHash: null, otpExpiry: null }),
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
  });
}
