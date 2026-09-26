import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Plum gradient bar that tops a section card: 8px top radius, square bottom (DESIGN.md). */
export function SectionHeaderBar({
  icon: Icon,
  title,
  badge,
  actions,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-plum-gradient flex min-h-12 flex-wrap items-center gap-3 rounded-t-lg px-5 py-2.5 text-white sm:px-6',
        className,
      )}
    >
      {Icon && <Icon className="size-5 shrink-0" aria-hidden />}
      <h2 className="font-display text-headline-sm font-semibold">{title}</h2>
      {badge && (
        <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-semibold">{badge}</span>
      )}
      {actions && <div className="ml-auto flex items-center gap-3 text-sm">{actions}</div>}
    </div>
  );
}

/** Standard panel: white surface, 1px divider, 8px radius. Pair with SectionHeaderBar. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn('overflow-hidden rounded-lg border border-divider bg-canvas', className)}
    >
      {children}
    </section>
  );
}
