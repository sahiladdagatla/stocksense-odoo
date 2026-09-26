import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { OpStatus, OpType } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Odoo-style pipeline (DESIGN.md): completed nodes solid pipeline plum with a check, the active
 * node outlined in plum with bold text, pending nodes grey. Receipts skip "Waiting".
 */
export function StatusStepper({
  status,
  type,
  className,
}: {
  status: OpStatus;
  type: OpType;
  className?: string;
}) {
  const steps: OpStatus[] =
    type === 'RECEIPT' ? ['DRAFT', 'READY', 'DONE'] : ['DRAFT', 'WAITING', 'READY', 'DONE'];
  const labels: Record<OpStatus, string> = {
    DRAFT: 'Draft',
    WAITING: 'Waiting',
    READY: 'Ready',
    DONE: 'Done',
    CANCELED: 'Canceled',
  };
  const canceled = status === 'CANCELED';
  const activeIndex = canceled ? -1 : steps.indexOf(status);

  return (
    <ol className={cn('flex items-start', className)} aria-label="Status">
      {steps.map((s, i) => {
        const done = !canceled && (i < activeIndex || status === 'DONE');
        const active = !canceled && i === activeIndex && status !== 'DONE';
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
            {i > 0 && (
              <span
                className={cn(
                  'absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2',
                  i <= activeIndex || status === 'DONE' ? 'bg-plum-pipeline' : 'bg-divider',
                )}
                aria-hidden
              />
            )}
            <motion.span
              layout
              initial={false}
              animate={{ scale: active ? 1.08 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className={cn(
                'relative z-10 flex size-8 items-center justify-center rounded-full border-2 bg-canvas',
                done && 'border-plum-pipeline bg-plum-pipeline text-white',
                active && 'border-plum-pipeline text-plum-pipeline ring-4 ring-plum-pipeline/15',
                !done && !active && 'border-divider text-muted-foreground',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? (
                <Check className="size-4" />
              ) : active ? (
                <span className="size-2.5 rounded-full bg-plum-pipeline" />
              ) : (
                <span className="size-2 rounded-full bg-divider" />
              )}
            </motion.span>
            <span
              className={cn(
                'text-xs',
                active
                  ? 'font-bold text-plum-pipeline'
                  : done
                    ? 'font-medium text-ink'
                    : 'text-muted-foreground',
              )}
            >
              {labels[s]}
            </span>
          </li>
        );
      })}
      {canceled && (
        <li className="flex flex-col items-center gap-1.5 pl-4">
          <span className="flex size-8 items-center justify-center rounded-full bg-danger text-white">
            <X className="size-4" />
          </span>
          <span className="text-xs font-bold text-danger">Canceled</span>
        </li>
      )}
    </ol>
  );
}
