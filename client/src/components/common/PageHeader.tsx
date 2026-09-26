import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, KanbanSquare, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Crumb = { label: string; to?: string };
export type ViewMode = 'list' | 'kanban';

/**
 * Page title row: breadcrumbs, title + subtitle, primary actions (e.g. "New"), and an optional
 * list/kanban toggle (DESIGN.md / Stitch layouts).
 */
export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
  view,
  onViewChange,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  view?: ViewMode;
  onViewChange?: (v: ViewMode) => void;
}) {
  return (
    <header className="mb-6">
      {crumbs && crumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1 text-sm text-muted-foreground"
        >
          {crumbs.map((c, i) => (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
              {c.to ? (
                <Link to={c.to} className="hover:text-plum-nav hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="text-ink">{c.label}</span>
              )}
            </Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-headline-lg font-semibold text-ink">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view && onViewChange && (
            <div
              role="radiogroup"
              aria-label="View"
              className="flex rounded-lg border border-divider bg-canvas p-0.5"
            >
              {(
                [
                  ['list', List, 'List view'],
                  ['kanban', KanbanSquare, 'Kanban view'],
                ] as const
              ).map(([v, Icon, label]) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={view === v}
                  aria-label={label}
                  title={label}
                  onClick={() => onViewChange(v)}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors',
                    view === v ? 'bg-plum text-primary-foreground' : 'hover:bg-row-hover',
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
}
