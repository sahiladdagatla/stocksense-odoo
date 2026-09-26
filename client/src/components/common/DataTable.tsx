import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Hide on narrow screens. */
  hideBelow?: 'sm' | 'md' | 'lg';
};

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };
const align = { left: 'text-left', right: 'text-right', center: 'text-center' };

/**
 * DESIGN.md data table: #F8F9FA 38px uppercase header, 48px rows with divider rules and
 * #F6F4F5 hover. Handles loading skeletons and the empty state.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  onRowClick,
  footer,
  className,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  footer?: ReactNode;
  className?: string;
}) {
  const showSkeleton = loading && !rows?.length;
  return (
    <div className={cn('overflow-hidden rounded-lg border border-divider bg-canvas', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="h-[38px] border-b border-divider bg-deck">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'px-4 text-label font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase',
                    align[c.align ?? 'left'],
                    c.hideBelow && hide[c.hideBelow],
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showSkeleton &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="h-12 border-b border-divider last:border-0">
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4', c.hideBelow && hide[c.hideBelow])}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))}
            {!showSkeleton &&
              rows?.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'h-12 border-b border-divider transition-colors last:border-0 hover:bg-row-hover',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-4 py-2',
                        align[c.align ?? 'left'],
                        c.hideBelow && hide[c.hideBelow],
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!showSkeleton && rows?.length === 0 && empty}
      {footer}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  noun = 'records',
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1,
  );
  const btn =
    'flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition-colors disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider bg-deck px-4 py-3 text-sm text-muted-foreground">
      <span>
        Showing{' '}
        <b className="text-ink">
          {from}–{to}
        </b>{' '}
        of <b className="text-ink">{total}</b> {noun}
      </span>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          className={cn(btn, 'hover:bg-row-hover')}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft className="size-4" /> Previous
        </button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center">
            {i > 0 && n - (nums[i - 1] ?? n) > 1 && <span className="px-1">…</span>}
            <button
              className={cn(
                btn,
                n === page ? 'bg-plum text-primary-foreground' : 'hover:bg-row-hover',
              )}
              aria-current={n === page ? 'page' : undefined}
              onClick={() => onPage(n)}
            >
              {n}
            </button>
          </span>
        ))}
        <button
          className={cn(btn, 'hover:bg-row-hover')}
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next <ChevronRight className="size-4" />
        </button>
      </nav>
    </div>
  );
}
