import { useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, MapPin, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { fmtSchedule, OP_META, scheduleFlag } from '@/lib/operations';
import { initials } from '@/lib/format';
import type { OperationSummary, OpStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const COLUMNS: { status: OpStatus; label: string; dot: string; hint?: string }[] = [
  { status: 'DRAFT', label: 'Draft', dot: 'bg-draft' },
  { status: 'WAITING', label: 'Waiting', dot: 'bg-warning', hint: 'Short on stock' },
  { status: 'READY', label: 'Ready', dot: 'bg-teal' },
  { status: 'DONE', label: 'Done', dot: 'bg-success', hint: 'Most recent' },
];

/** Allowed drag moves: confirm a draft, or validate a ready/waiting document. */
function actionFor(from: OpStatus, to: OpStatus): 'confirm' | 'validate' | null {
  if (from === 'DRAFT' && (to === 'READY' || to === 'WAITING')) return 'confirm';
  if ((from === 'READY' || from === 'WAITING') && to === 'DONE') return 'validate';
  return null;
}

function Card({ op, onDragStart }: { op: OperationSummary; onDragStart: (e: DragEvent) => void }) {
  const navigate = useNavigate();
  const meta = OP_META[op.type];
  const flag = scheduleFlag(op.scheduledDate, op.status);
  const place =
    op.type === 'RECEIPT'
      ? op.destLoc.fullName
      : op.type === 'DELIVERY'
        ? op.sourceLoc.fullName
        : `${op.sourceLoc.fullName} → ${op.destLoc.fullName}`;
  const draggable = op.status !== 'DONE';
  return (
    <div draggable={draggable} onDragStart={onDragStart}>
      <motion.article
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        onClick={() => navigate(`${meta.path}/${op.id}`)}
        onKeyDown={(e) => e.key === 'Enter' && navigate(`${meta.path}/${op.id}`)}
        tabIndex={0}
        aria-label={`${op.reference}, ${op.partner ?? meta.label}`}
        className={cn(
          'cursor-pointer rounded-lg border border-divider bg-canvas p-4 transition-shadow outline-none hover:shadow-overlay focus-visible:ring-[3px] focus-visible:ring-plum/25',
          draggable && 'active:cursor-grabbing',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[13px] font-semibold text-plum-nav">{op.reference}</span>
          {flag && (
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                flag.tone === 'late' ? 'bg-danger/10 text-danger' : 'bg-teal/10 text-teal',
              )}
            >
              {flag.label}
            </span>
          )}
        </div>
        <p className="mt-2 font-semibold text-ink">{op.partner ?? meta.label}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Package className="size-3.5" /> {op._count.lines} product
          {op._count.lines === 1 ? '' : 's'}
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0" /> <span className="break-all">{place}</span>
        </p>
        {op.status === 'WAITING' && (
          <p className="mt-2 rounded border-l-2 border-warning bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
            Not enough stock at source
          </p>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-divider pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" /> {fmtSchedule(op.validatedAt ?? op.scheduledDate)}
          </span>
          <span
            className="flex size-6 items-center justify-center rounded-md bg-plum-tint text-[10px] font-bold text-plum"
            title={op.createdBy.name}
          >
            {initials(op.createdBy.name)}
          </span>
        </div>
      </motion.article>
    </div>
  );
}

export function KanbanBoard({
  items,
  loading,
  onConfirm,
  onValidate,
}: {
  items: OperationSummary[];
  loading: boolean;
  onConfirm: (op: OperationSummary) => void;
  onValidate: (op: OperationSummary) => void;
}) {
  const [dragging, setDragging] = useState<OperationSummary | null>(null);
  const [over, setOver] = useState<OpStatus | null>(null);

  const drop = (to: OpStatus) => {
    const op = dragging;
    setDragging(null);
    setOver(null);
    if (!op) return;
    const action = actionFor(op.status, to);
    if (action === 'confirm') onConfirm(op);
    if (action === 'validate') onValidate(op);
  };

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const cards = items.filter((o) => o.status === col.status);
          const allowed = dragging ? actionFor(dragging.status, col.status) !== null : false;
          return (
            <section
              key={col.status}
              aria-label={col.label}
              onDragOver={(e) => {
                if (!allowed) return;
                e.preventDefault();
                setOver(col.status);
              }}
              onDragLeave={() => setOver((s) => (s === col.status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                drop(col.status);
              }}
              className={cn(
                'flex min-h-40 flex-col rounded-lg md:min-h-80 border border-divider bg-deck p-3 transition-colors',
                dragging && allowed && 'border-dashed border-plum',
                over === col.status && 'bg-plum-tint',
              )}
            >
              <header className="mb-3 flex items-center gap-2 px-1">
                <span className={cn('size-2.5 rounded-full', col.dot)} />
                <h3 className="font-display font-semibold">{col.label}</h3>
                <span className="rounded-full bg-canvas px-2 text-xs font-semibold text-muted-foreground">
                  {cards.length}
                </span>
                {col.hint && (
                  <span className="ml-auto text-[11px] text-muted-foreground">{col.hint}</span>
                )}
              </header>
              <div className="flex flex-1 flex-col gap-3">
                {loading && [1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
                {!loading && cards.length === 0 && (
                  <p className="px-1 pt-6 text-center text-sm text-muted-foreground">
                    Nothing here
                  </p>
                )}
                {cards.map((op) => (
                  <Card
                    key={op.id}
                    op={op}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', op.reference);
                      setDragging(op);
                    }}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Drag a draft to Ready to confirm it, or a ready card to Done to validate it.
      </p>
    </div>
  );
}
