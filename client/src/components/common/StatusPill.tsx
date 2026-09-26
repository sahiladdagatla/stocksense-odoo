import { cn } from '@/lib/utils';
import type { OpStatus, StockStatus } from '@/lib/types';

const OP: Record<OpStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-draft' },
  WAITING: { label: 'Waiting', cls: 'bg-warning' },
  READY: { label: 'Ready', cls: 'bg-teal' },
  DONE: { label: 'Done', cls: 'bg-success' },
  CANCELED: { label: 'Canceled', cls: 'bg-danger' },
};

/** Workflow pill: 24px, fully rounded, bold 12px uppercase white text (DESIGN.md). */
export function StatusPill({ status, className }: { status: OpStatus; className?: string }) {
  const s = OP[status];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold tracking-wide text-white uppercase',
        s.cls,
        className,
      )}
    >
      {s.label}
    </span>
  );
}

const STOCK: Record<StockStatus, { label: string; cls: string; dot: string }> = {
  IN_STOCK: { label: 'In stock', cls: 'bg-success/10 text-success', dot: 'bg-success' },
  LOW: { label: 'Low', cls: 'bg-warning/12 text-warning', dot: 'bg-warning' },
  OUT: { label: 'Out of stock', cls: 'bg-danger/10 text-danger', dot: 'bg-danger' },
};

/** Soft badge for product stock level. */
export function StockBadge({ status, className }: { status: StockStatus; className?: string }) {
  const s = STOCK[status];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold',
        s.cls,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}
