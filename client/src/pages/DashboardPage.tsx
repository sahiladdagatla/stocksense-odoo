import { useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ChevronDown,
  History,
  Loader2,
  Plus,
  RotateCcw,
  ShoppingCart,
  Tags,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, type Column } from '@/components/common/DataTable';
import { FilterSelect } from '@/components/common/FilterSelect';
import { Panel, SectionHeaderBar } from '@/components/common/SectionHeaderBar';
import { EmptyState, ErrorState } from '@/components/common/States';
import { StatusPill } from '@/components/common/StatusPill';
import { useCategories, useLocations } from '@/hooks/useMasterData';
import { useLiveStatus } from '@/hooks/useLiveUpdates';
import { useOperations } from '@/hooks/useOperations';
import { api, errorMessage } from '@/lib/api';
import { fmtInt, fmtQty, fmtTime } from '@/lib/format';
import { fmtSchedule, OP_META } from '@/lib/operations';
import type { OperationDetail, OperationSummary, OpStatus, OpType, StockStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useWarehouse } from '@/providers/warehouse';

type Kpis = {
  productsInStock: number;
  lowStock: number;
  outOfStock: number;
  pendingReceipts: number;
  receiptsDueToday: number;
  pendingDeliveries: number;
  deliveriesReady: number;
  scheduledTransfers: number;
  nextTransfer: { scheduledDate: string; reference: string } | null;
  warehouses: number;
};
type Chart = {
  days: { date: string; inbound: number; outbound: number }[];
  totalInbound: number;
  totalOutbound: number;
};
type ReorderItem = {
  product: { id: number; name: string; sku: string; uom: string };
  onHand: number;
  reorderMin: number;
  reorderQty: number;
  stockStatus: StockStatus;
  avgDailyOut: number;
  daysLeft: number | null;
  incomingQty: number;
};

const DOC_TYPES: { value: OpType | undefined; label: string }[] = [
  { value: undefined, label: 'All documents' },
  { value: 'RECEIPT', label: 'Receipts' },
  { value: 'DELIVERY', label: 'Deliveries' },
  { value: 'INTERNAL', label: 'Transfers' },
  { value: 'ADJUSTMENT', label: 'Adjustments' },
];

function KpiCard({
  label,
  value,
  note,
  to,
  tone,
}: {
  label: string;
  value: ReactNode;
  note: ReactNode;
  to: string;
  tone?: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-lg border border-divider bg-canvas p-5 transition-colors outline-none hover:border-plum focus-visible:ring-[3px] focus-visible:ring-plum/25"
    >
      <span className="text-label font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          'mt-3 font-mono text-[32px] leading-none font-semibold',
          tone ?? 'text-plum-deep dark:text-plum',
        )}
      >
        {value}
      </span>
      <span className="mt-3 text-sm text-muted-foreground group-hover:text-ink">{note}</span>
    </Link>
  );
}

function MovementChart({ data, loading }: { data?: Chart; loading: boolean }) {
  const animate = !useReducedMotion();
  const rows = (data?.days ?? []).map((d, i, all) => {
    const date = new Date(`${d.date}T12:00:00`);
    return {
      ...d,
      label:
        i === all.length - 1 ? 'Today' : date.toLocaleDateString('en-IN', { weekday: 'short' }),
      sub: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    };
  });
  return (
    <Panel className="flex flex-col">
      <SectionHeaderBar
        icon={BarChart3}
        title="Stock movement · last 7 days"
        actions={
          data && (
            <span className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-chart-in ring-1 ring-white/60" /> Inbound{' '}
                {fmtQty(data.totalInbound)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-chart-out ring-1 ring-white/60" /> Outbound{' '}
                {fmtQty(data.totalOutbound)}
              </span>
            </span>
          )
        }
      />
      <div className="h-80 p-4 pt-6">
        {loading || !data ? (
          <Skeleton className="size-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              barGap={2}
              barCategoryGap="28%"
              margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--divider)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: 'var(--divider)' }}
                tick={({ x, y, payload, index }) => (
                  <g transform={`translate(${Number(x)},${Number(y) + 12})`}>
                    <text
                      textAnchor="middle"
                      fill="var(--ink)"
                      fontSize={12}
                      fontWeight={index === rows.length - 1 ? 700 : 500}
                    >
                      {payload.value}
                    </text>
                    <text
                      textAnchor="middle"
                      y={15}
                      fill="var(--ink-muted)"
                      fontSize={11}
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {rows[index]?.sub}
                    </text>
                  </g>
                )}
                height={40}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--row-hover)' }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !p) return null;
                  return (
                    <div className="rounded-lg border border-divider bg-popover p-3 text-sm shadow-overlay">
                      <p className="mb-1.5 font-semibold text-ink">
                        {p.label} · {p.sub}
                      </p>
                      <p className="flex items-center gap-2 text-ink">
                        <span className="size-2.5 rounded-sm bg-chart-in" /> Inbound{' '}
                        <b className="ml-auto pl-4 font-mono">{fmtQty(p.inbound)}</b>
                      </p>
                      <p className="flex items-center gap-2 text-ink">
                        <span className="size-2.5 rounded-sm bg-chart-out" /> Outbound{' '}
                        <b className="ml-auto pl-4 font-mono">{fmtQty(p.outbound)}</b>
                      </p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="inbound"
                name="Inbound"
                fill="var(--chart-in)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={animate}
                maxBarSize={28}
              />
              <Bar
                dataKey="outbound"
                name="Outbound"
                fill="var(--chart-out)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={animate}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {/* Screen-reader / no-colour table view of the same data. */}
      {data && (
        <table className="sr-only">
          <caption>Units moved in and out per day, last 7 days</caption>
          <thead>
            <tr>
              <th>Day</th>
              <th>Inbound</th>
              <th>Outbound</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                <td>{r.sub}</td>
                <td>{r.inbound}</td>
                <td>{r.outbound}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function ReorderPanel({
  items,
  loading,
  warehouseId,
}: {
  items?: ReorderItem[];
  loading: boolean;
  warehouseId: number | null;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: locations = [] } = useLocations();
  const [busyId, setBusyId] = useState<number | null>(null);
  const critical =
    items?.filter((i) => i.stockStatus === 'OUT' || (i.daysLeft !== null && i.daysLeft <= 3))
      .length ?? 0;

  async function generate(item: ReorderItem) {
    // Default destination: the main stock location of the selected warehouse (or the first one).
    const dest =
      locations.find((l) => (!warehouseId || l.warehouseId === warehouseId) && !l.parentId) ??
      locations[0];
    if (!dest) return toast.error('Create a stock location first');
    const qty =
      item.reorderQty > 0 ? item.reorderQty : Math.max(1, item.reorderMin * 2 - item.onHand);
    setBusyId(item.product.id);
    try {
      const op = await api.post<OperationDetail>('/operations', {
        type: 'RECEIPT',
        destLocId: dest.id,
        notes: `Reorder: ${item.product.name} below minimum (${fmtQty(item.onHand)}/${fmtQty(item.reorderMin)} ${item.product.uom})`,
        lines: [{ productId: item.product.id, demandQty: qty }],
      });
      await Promise.all(
        ['operations', 'dashboard'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
      );
      toast.success(`Draft ${op.reference} created for ${fmtQty(qty)} ${item.product.uom}`, {
        action: { label: 'Open', onClick: () => navigate(`/receipts/${op.id}`) },
      });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel className="flex flex-col">
      <SectionHeaderBar
        icon={AlertTriangle}
        title="Reorder soon"
        badge={items ? `${critical} critical` : undefined}
      />
      <div className="max-h-[23rem] flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-3 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        )}
        {items?.length === 0 && (
          <EmptyState
            icon={ShoppingCart}
            title="All stocked up"
            description="No product is below its reorder minimum."
          />
        )}
        <ul className="divide-y divide-divider">
          {items?.map((i) => {
            const pct = i.reorderMin > 0 ? Math.min(100, (i.onHand / i.reorderMin) * 100) : 0;
            return (
              <li key={i.product.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/products/${i.product.id}`}
                      className="font-semibold text-ink hover:underline"
                    >
                      {i.product.name}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">SKU: {i.product.sku}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void generate(i)}
                    disabled={busyId === i.product.id}
                  >
                    {busyId === i.product.id ? <Loader2 className="animate-spin" /> : <Plus />}{' '}
                    Receipt
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-xs">
                  <span className="text-ink">
                    {fmtQty(i.onHand)} {i.product.uom} / {fmtQty(i.reorderMin)} {i.product.uom}
                  </span>
                  <span
                    className={cn(
                      'font-sans font-semibold',
                      i.stockStatus === 'OUT' ? 'text-danger' : 'text-warning',
                    )}
                  >
                    {i.stockStatus === 'OUT'
                      ? 'Out of stock'
                      : i.daysLeft === null
                        ? 'No recent outflow'
                        : `~${i.daysLeft} day${i.daysLeft === 1 ? '' : 's'} left`}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-deck">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      i.stockStatus === 'OUT' ? 'bg-danger' : 'bg-warning',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {i.incomingQty > 0 && (
                  <p className="mt-1.5 text-xs text-teal">
                    {fmtQty(i.incomingQty)} {i.product.uom} already on open receipts
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const live = useLiveStatus();
  const { warehouses, warehouseId: globalWh } = useWarehouse();
  const { data: categories = [] } = useCategories();
  const [docType, setDocType] = useState<OpType | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [wh, setWh] = useState<string | undefined>();
  const [categoryId, setCategoryId] = useState<string | undefined>();

  const warehouseId = wh === 'all' ? null : wh ? Number(wh) : globalWh;
  const scope = {
    warehouseId: warehouseId ?? undefined,
    categoryId: categoryId ? Number(categoryId) : undefined,
  };
  const kpis = useQuery({
    queryKey: ['dashboard', 'kpis', scope],
    queryFn: () => api.get<Kpis>('/dashboard/kpis', scope),
  });
  const chart = useQuery({
    queryKey: ['dashboard', 'chart', scope],
    queryFn: () =>
      api.get<Chart>('/dashboard/movement-chart', {
        ...scope,
        tzOffset: new Date().getTimezoneOffset(),
      }),
  });
  const reorder = useQuery({
    queryKey: ['dashboard', 'reorder', scope],
    queryFn: () => api.get<ReorderItem[]>('/dashboard/reorder', scope),
  });
  const recent = useOperations({
    type: docType,
    status: status === 'pending' ? ['WAITING', 'READY'] : status ? [status as OpStatus] : undefined,
    warehouseId,
    categoryId: scope.categoryId,
    pageSize: 8,
  });

  const k = kpis.data;
  const filtered = !!(docType || status || wh || categoryId);
  const whQuery = warehouseId ? `&warehouseId=${warehouseId}` : '';

  const columns: Column<OperationSummary>[] = [
    {
      key: 'ref',
      header: 'Reference',
      cell: (o) => (
        <span className="font-mono text-[13px] font-semibold whitespace-nowrap text-plum-nav">
          {o.reference}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      hideBelow: 'md',
      cell: (o) => {
        const Icon = OP_META[o.type].icon;
        return (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Icon className="size-4 text-muted-foreground" /> {OP_META[o.type].label}
          </span>
        );
      },
    },
    { key: 'partner', header: 'Partner', hideBelow: 'lg', cell: (o) => o.partner ?? '—' },
    {
      key: 'route',
      header: 'Route (from → to)',
      hideBelow: 'lg',
      cell: (o) => (
        <span className="text-xs">
          {o.sourceLoc.fullName.replace('Virtual/', '')} →{' '}
          {o.destLoc.fullName.replace('Virtual/', '')}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Scheduled',
      cell: (o) => (
        <span className="text-[13px] whitespace-nowrap">{fmtSchedule(o.scheduledDate)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      cell: (o) => <StatusPill status={o.status} />,
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <h1 className="font-display text-headline-lg font-semibold">Dashboard</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-semibold',
                live ? 'bg-success/10 text-success' : 'bg-deck text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  live ? 'animate-pulse bg-success' : 'bg-draft',
                )}
              />{' '}
              {live ? 'Live' : 'Offline'}
            </span>
            Snapshot ·{' '}
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
            , {fmtTime(new Date())}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus /> New operation <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {(['RECEIPT', 'DELIVERY', 'INTERNAL', 'ADJUSTMENT'] as const).map((t) => {
              const Icon = OP_META[t].icon;
              return (
                <DropdownMenuItem
                  key={t}
                  onSelect={() =>
                    navigate(t === 'ADJUSTMENT' ? '/adjustments' : `${OP_META[t].path}/new`)
                  }
                >
                  <Icon /> {OP_META[t].label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-divider bg-info-bg/40 p-4">
        <div
          className="flex flex-wrap rounded-lg border border-divider bg-canvas p-1"
          role="radiogroup"
          aria-label="Document type"
        >
          {DOC_TYPES.map((d) => (
            <button
              key={d.label}
              role="radio"
              aria-checked={docType === d.value}
              onClick={() => setDocType(d.value)}
              className={cn(
                'h-8 rounded-md px-3 text-sm whitespace-nowrap',
                docType === d.value
                  ? 'bg-plum-deep font-semibold text-white'
                  : 'text-ink hover:bg-row-hover',
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
        <FilterSelect
          ariaLabel="Status"
          value={status}
          onChange={setStatus}
          allLabel="Any status"
          options={[
            { value: 'pending', label: 'Pending (waiting + ready)' },
            ...(['DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED'] as const).map((s) => ({
              value: s,
              label: s[0] + s.slice(1).toLowerCase(),
            })),
          ]}
        />
        <FilterSelect
          ariaLabel="Warehouse"
          icon={<Building2 className="size-4 text-muted-foreground" />}
          value={warehouseId ? String(warehouseId) : 'all'}
          onChange={(v) => setWh(v ?? 'all')}
          options={[
            { value: 'all', label: 'All warehouses' },
            ...warehouses.map((w) => ({ value: String(w.id), label: `${w.code} · ${w.name}` })),
          ]}
        />
        <FilterSelect
          ariaLabel="Category"
          icon={<Tags className="size-4 text-muted-foreground" />}
          value={categoryId}
          onChange={setCategoryId}
          allLabel="All categories"
          options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
        />
        {filtered && (
          <Button
            variant="link"
            className="text-sm"
            onClick={() => (
              setDocType(undefined),
              setStatus(undefined),
              setWh(undefined),
              setCategoryId(undefined)
            )}
          >
            <RotateCcw className="size-3.5" /> Clear filters
          </Button>
        )}
      </div>

      {kpis.error ? (
        <ErrorState error={kpis.error} onRetry={() => void kpis.refetch()} />
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {!k ? (
            [1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-36" />)
          ) : (
            <>
              <KpiCard
                label="Products in stock"
                value={fmtInt(k.productsInStock)}
                note={`across ${k.warehouses} warehouse${k.warehouses === 1 ? '' : 's'}`}
                to={`/products?status=IN_STOCK${whQuery}`}
              />
              <KpiCard
                label="Low / out of stock"
                value={
                  <span>
                    <span className="text-warning">{k.lowStock}</span>{' '}
                    <span className="text-2xl text-muted-foreground">/</span>{' '}
                    <span className="text-danger">{k.outOfStock}</span>
                  </span>
                }
                note={
                  <span className="flex items-center gap-1.5 text-warning">
                    <span className="size-1.5 rounded-full bg-warning" /> needs attention
                  </span>
                }
                to={`/products?status=${k.outOfStock ? 'OUT' : 'LOW'}${whQuery}`}
                tone="text-ink"
              />
              <KpiCard
                label="Pending receipts"
                value={k.pendingReceipts}
                note={`${k.receiptsDueToday} arriving today`}
                to={`/receipts?status=pending${whQuery}`}
              />
              <KpiCard
                label="Pending deliveries"
                value={k.pendingDeliveries}
                note={`${k.deliveriesReady} ready to ship`}
                to={`/deliveries?status=pending${whQuery}`}
              />
              <KpiCard
                label="Internal transfers"
                value={k.scheduledTransfers}
                note={
                  k.nextTransfer
                    ? `next ${fmtSchedule(k.nextTransfer.scheduledDate).replace(', ', ' at ')}`
                    : 'none scheduled'
                }
                to={`/transfers?status=pending${whQuery}`}
              />
            </>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <MovementChart data={chart.data} loading={chart.isLoading} />
        <ReorderPanel items={reorder.data} loading={reorder.isLoading} warehouseId={warehouseId} />
      </div>

      <Panel>
        <SectionHeaderBar
          icon={History}
          title="Recent operations"
          actions={
            <Link to="/moves" className="font-medium underline-offset-4 hover:underline">
              View move history →
            </Link>
          }
        />
        <DataTable
          className="rounded-t-none border-0"
          columns={columns}
          rows={recent.data?.items}
          rowKey={(o) => o.id}
          loading={recent.isLoading}
          onRowClick={(o) =>
            navigate(
              o.type === 'ADJUSTMENT'
                ? `/moves?search=${encodeURIComponent(o.reference)}`
                : `${OP_META[o.type].path}/${o.id}`,
            )
          }
          empty={
            <EmptyState
              icon={History}
              title="No operations match"
              description="Try a different document type or status."
            />
          }
        />
      </Panel>
    </>
  );
}
