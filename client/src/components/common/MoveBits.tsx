import { ArrowRight } from 'lucide-react';
import { fmtQty } from '@/lib/format';
import type { LocRef, Move } from '@/lib/types';
import { cn } from '@/lib/utils';
import { moveSign } from '@/lib/moves';

export function MoveQty({ move }: { move: Move }) {
  const sign = moveSign(move);
  return (
    <span
      className={cn(
        'font-mono text-[13px] font-semibold whitespace-nowrap',
        sign > 0 && 'text-success',
        sign < 0 && 'text-danger',
        sign === 0 && 'text-ink',
      )}
    >
      {sign > 0 ? '+' : sign < 0 ? '−' : ''}
      {fmtQty(move.quantity)} {move.product.uom}
    </span>
  );
}

const locLabel = (l: LocRef) =>
  l.type === 'INTERNAL' ? l.fullName : l.fullName.replace(/^Virtual\//, '');

function Loc({ loc }: { loc: LocRef }) {
  return (
    <span className={cn(loc.type === 'INTERNAL' ? 'text-ink' : 'text-muted-foreground italic')}>
      {locLabel(loc)}
    </span>
  );
}

export function MoveRoute({ move }: { move: Pick<Move, 'fromLoc' | 'toLoc'> }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      <Loc loc={move.fromLoc} />
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-label="to" />
      <Loc loc={move.toLoc} />
    </span>
  );
}
