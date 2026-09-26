import type { Move } from './types';

/**
 * Signed quantity from the stock's point of view: + when stock enters the company (virtual →
 * internal), − when it leaves (internal → virtual), neutral for internal transfers.
 */
export function moveSign(m: Pick<Move, 'fromLoc' | 'toLoc'>): 1 | -1 | 0 {
  const fromIn = m.fromLoc.type === 'INTERNAL';
  const toIn = m.toLoc.type === 'INTERNAL';
  if (toIn && !fromIn) return 1;
  if (fromIn && !toIn) return -1;
  return 0;
}
