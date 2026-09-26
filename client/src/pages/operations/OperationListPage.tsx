import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Plus,
  ScanSearch,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, Pagination, type Column } from '@/components/common/DataTable';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader, type ViewMode } from '@/components/common/PageHeader';
import { EmptyState, ErrorState } from '@/components/common/States';
import { StatusPill } from '@/components/common/StatusPill';
import { KanbanBoard } from '@/components/operations/KanbanBoard';
import { useOperationActions } from '@/hooks/useOperationActions';
import { useOperationCounts, useOperations } from '@/hooks/useOperations';
import { fmtSchedule, OP_META, scheduleFlag, type DocType } from '@/lib/operations';
import { initials } from '@/lib/format';
import type { OperationSummary, OpStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useWarehouse } from '@/providers/warehouse';

const TABS: { key: string; label: string; statuses: OpStatus[] }[] = [
  { key: 'all', label: 'All', statuses: [] },
  { key: 'pending', label: 'Pending', statuses: ['WAITING', 'READY'] },
  { key: 'DRAFT', label: 'Draft', statuses: ['DRAFT'] },
  { key: 'WAITING', label: 'Waiting', statuses: ['WAITING'] },
  { key: 'READY', label: 'Ready', statuses: ['READY'] },
  { key: 'DONE', label: 'Done', statuses: ['DONE'] },
  { key: 'CANCELED', label: 'Canceled', statuses: ['CANCELED'] },
];

function LocationChip({ name }: { name: string }) {
  return (
    <span className="inline-block rounded border border-divider bg-deck px-1.5 py-0.5 font-mono text-xs break-all text-ink">
      {name}
    </span>
  );
}

/** One list for receipts, deliveries and transfers; everything type-specific comes from OP_META. */
export function OperationListPage({ type }: { type: DocType }) {
  const meta = OP_META[type];
  const navigate = useNavigate();
  const { warehouses, warehouseId: globalWh } = useWarehouse();
  const [params, setParams] = useSearchParams();
  const actions = useOperationActions();

  const view: ViewMode = params.get('view') === 'kanban' ? 'kanban' : 'list';
  const search = params.get('search') ?? '';
  const statusParam = params.get('status');
  const tab =
    TABS.find((t) => t.key === statusParam) ??
    (statusParam === 'READY,WAITING' || statusParam === 'WAITING,READY' ? TABS[1] : TABS[0])!;
  const whParam = params.get('warehouseId');
  const warehouseId = whParam === 'all' ? null : Number(whParam) || globalWh;
  const categoryId = Number(params.get('categoryId')) || undefined;
  const page = Number(params.get('page')) || 1;

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const base = { type, warehouseId, categoryId, search };
  const counts = useOperationCounts(base);
  const list = useOperations({ ...base, status: tab.statuses, page }, view === 'list');
  const openBoard = useOperations(
    { ...base, status: ['DRAFT', 'WAITING', 'READY'], pageSize: 200 },
    view === 'kanban',
  );
  const doneBoard = useOperations({ ...base, status: ['DONE'], pageSize: 12 }, view === 'kanban');

  const partnerCol: Column<OperationSummary>[] = meta.partnerLabel
    ? [
        {
          key: 'partner',
          header: meta.partnerLabel,
          cell: (o) => <span className="font-medium text-ink">{o.partner ?? '—'}</span>,
        },
      ]
    : [];
  const locCol: Column<OperationSummary> =
    type === 'RECEIPT'
      ? {
          key: 'loc',
          header: 'Destination',
          hideBelow: 'md',
          cell: (o) => <LocationChip name={o.destLoc.fullName} />,
        }
      : type === 'DELIVERY'
        ? {
            key: 'loc',
            header: 'Source',
            hideBelow: 'md',
            cell: (o) => <LocationChip name={o.sourceLoc.fullName} />,
          }
        : {
            key: 'loc',
            header: 'From → To',
            hideBelow: 'md',
            cell: (o) => (
              <span className="flex flex-wrap items-center gap-1">
                <LocationChip name={o.sourceLoc.fullName} /> →{' '}
                <LocationChip name={o.destLoc.fullName} />
              </span>
            ),
          };

  const columns: Column<OperationSummary>[] = [
    {
      key: 'ref',
      header: 'Reference',
      cell: (o) => (
        <Link
          to={`${meta.path}/${o.id}`}
          className="font-mono text-[13px] font-semibold whitespace-nowrap text-plum-nav hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {o.reference}
        </Link>
      ),
    },
    ...partnerCol,
    locCol,
    {
      key: 'lines',
      header: 'Products',
      hideBelow: 'xl',
      cell: (o) => `${o._count.lines} item${o._count.lines === 1 ? '' : 's'}`,
    },
    {
      key: 'date',
      header: 'Scheduled',
      cell: (o) => {
        const flag = scheduleFlag(o.scheduledDate, o.status);
        return (
          <span className="flex flex-col items-start gap-1 whitespace-nowrap">
            <span className={cn('font-mono text-[13px]', flag?.tone === 'late' && 'text-danger')}>
              {fmtSchedule(o.scheduledDate)}
            </span>
            {flag && (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase',
                  flag.tone === 'late' ? 'bg-danger/10 text-danger' : 'bg-teal/10 text-teal',
                )}
              >
                {flag.label}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'by',
      header: 'Responsible',
      hideBelow: '2xl',
      cell: (o) => (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="flex size-6 items-center justify-center rounded-md bg-plum-tint text-[10px] font-bold text-plum">
            {initials(o.createdBy.name)}
          </span>
          {o.createdBy.name}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      cell: (o) => <StatusPill status={o.status} />,
    },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      cell: (o) => {
        const label =
          o.status === 'READY'
            ? 'Process'
            : o.status === 'WAITING'
              ? 'Check'
              : o.status === 'DRAFT'
                ? 'Edit'
                : 'View';
        return (
          <Button
            size="sm"
            variant={o.status === 'READY' ? 'default' : 'outline'}
            onClick={(e) => (e.stopPropagation(), navigate(`${meta.path}/${o.id}`))}
          >
            {label}
          </Button>
        );
      },
    },
  ];

  const c = counts.data;
  const filtered = !!(search || categoryId);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Operations' }, { label: meta.plural }]}
        title={meta.plural}
        subtitle={meta.tagline}
        view={view}
        onViewChange={(v) => set({ view: v === 'kanban' ? 'kanban' : undefined })}
        actions={
          <Button asChild>
            <Link to={`${meta.path}/new`}>
              <Plus /> New {meta.label.toLowerCase()}
            </Link>
          </Button>
        }
      />

      {view === 'list' ? (
        <div
          className="mb-4 flex flex-wrap gap-1 rounded-lg border border-divider bg-canvas p-1.5"
          role="tablist"
          aria-label="Status"
        >
          {TABS.filter((t) => !(type === 'RECEIPT' && t.key === 'WAITING')).map((t) => {
            const n = !c
              ? undefined
              : t.key === 'all'
                ? c.total
                : t.statuses.reduce((a, s) => a + c[s], 0);
            const active = t.key === tab.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => set({ status: t.key === 'all' ? undefined : t.key })}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-md px-3 text-sm whitespace-nowrap transition-colors',
                  active
                    ? 'bg-plum-tint font-semibold text-plum-deep dark:text-plum'
                    : 'text-ink hover:bg-row-hover',
                )}
              >
                {t.label}
                {n !== undefined && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px] font-bold',
                      active ? 'bg-plum text-primary-foreground' : 'bg-deck text-muted-foreground',
                    )}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: ClipboardList,
              label: 'Unconfirmed',
              value: c?.DRAFT,
              unit: 'drafts',
              tone: 'text-draft',
            },
            {
              icon: AlertTriangle,
              label: 'Stock shortage',
              value: c?.WAITING,
              unit: 'waiting',
              tone: 'text-warning',
            },
            {
              icon: ScanSearch,
              label: 'Ready to process',
              value: c?.READY,
              unit: 'ready',
              tone: 'text-teal',
            },
            {
              icon: CheckCircle2,
              label: 'Completed',
              value: c?.DONE,
              unit: 'done',
              tone: 'text-success',
            },
          ].map((k) => (
            <div
              key={k.label}
              className="flex items-center gap-3 rounded-lg border border-divider bg-canvas p-4"
            >
              <span
                className={cn(
                  'flex size-10 items-center justify-center rounded-lg bg-deck',
                  k.tone,
                )}
              >
                <k.icon className="size-5" />
              </span>
              <div>
                <p className={cn('text-xs font-semibold tracking-wide uppercase', k.tone)}>
                  {k.label}
                </p>
                <p className="font-display text-headline-md font-semibold">
                  {k.value ?? '–'}{' '}
                  <span className="text-sm font-normal text-muted-foreground">{k.unit}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-divider bg-canvas p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            key={search}
            defaultValue={search}
            placeholder={`Reference${meta.partnerLabel ? ` or ${meta.partnerLabel.toLowerCase()}` : ''}…`}
            aria-label="Search"
            onKeyDown={(e) =>
              e.key === 'Enter' && set({ search: e.currentTarget.value.trim() || undefined })
            }
            onBlur={(e) =>
              e.target.value.trim() !== search &&
              set({ search: e.target.value.trim() || undefined })
            }
            className="h-10 w-full rounded-lg border border-divider bg-deck pr-3 pl-9 text-sm outline-none focus:border-plum focus:bg-canvas focus:ring-[3px] focus:ring-plum/25"
          />
        </div>
        <FilterSelect
          ariaLabel="Warehouse"
          icon={<Building2 className="size-4 text-muted-foreground" />}
          value={warehouseId ? String(warehouseId) : 'all'}
          onChange={(v) => set({ warehouseId: v ?? 'all' })}
          options={[
            { value: 'all', label: 'All warehouses' },
            ...warehouses.map((w) => ({ value: String(w.id), label: `${w.code} · ${w.name}` })),
          ]}
        />
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set({ search: undefined, categoryId: undefined })}
          >
            Clear filters
          </Button>
        )}
      </div>

      {view === 'list' ? (
        list.error ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={list.data?.items}
            rowKey={(o) => o.id}
            loading={list.isLoading}
            onRowClick={(o) => navigate(`${meta.path}/${o.id}`)}
            empty={
              <EmptyState
                icon={meta.icon}
                title={
                  filtered || tab.key !== 'all'
                    ? `No ${meta.plural.toLowerCase()} match`
                    : `No ${meta.plural.toLowerCase()} yet`
                }
                description={
                  filtered || tab.key !== 'all'
                    ? 'Try another status tab or clear the search.'
                    : `Create your first ${meta.label.toLowerCase()} to get started.`
                }
                action={
                  <Button asChild>
                    <Link to={`${meta.path}/new`}>
                      <Plus /> New {meta.label.toLowerCase()}
                    </Link>
                  </Button>
                }
              />
            }
            footer={
              list.data && (
                <Pagination
                  page={list.data.page}
                  pageSize={list.data.pageSize}
                  total={list.data.total}
                  onPage={(p) => set({ page: String(p) })}
                  noun={meta.plural.toLowerCase()}
                />
              )
            }
          />
        )
      ) : (
        <KanbanBoard
          items={[...(openBoard.data?.items ?? []), ...(doneBoard.data?.items ?? [])]}
          loading={openBoard.isLoading || doneBoard.isLoading}
          onConfirm={(op) => void actions.confirm(op)}
          onValidate={(op) => actions.requestValidate(op)}
        />
      )}
      {actions.dialog}
    </>
  );
}
