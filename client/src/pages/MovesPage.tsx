import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  Download,
  History,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, Pagination, type Column } from '@/components/common/DataTable';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel, SectionHeaderBar } from '@/components/common/SectionHeaderBar';
import { EmptyState, ErrorState } from '@/components/common/States';
import { MoveQty, MoveRoute } from '@/components/common/MoveBits';
import { useLocations, useMoves, useProducts } from '@/hooks/useMasterData';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, fmtInt, fmtQty } from '@/lib/format';
import { OP_META } from '@/lib/operations';
import type { Move, OpType } from '@/lib/types';
import { cn } from '@/lib/utils';

type Integrity = {
  balanced: boolean;
  movesChecked: number;
  quantsChecked: number;
  checkedAt: string;
  discrepancies: {
    product: { name: string; sku: string };
    location: { fullName: string };
    ledgerQty: number;
    quantQty: number;
    difference: number;
  }[];
};

const TYPE_TONE: Record<OpType, string> = {
  RECEIPT: 'bg-success/10 text-success',
  DELIVERY: 'bg-chart-in/10 text-chart-in',
  INTERNAL: 'bg-plum-tint text-plum',
  ADJUSTMENT: 'bg-warning/12 text-warning',
};

function TypeBadge({ type }: { type: OpType }) {
  const Icon = OP_META[type].icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase',
        TYPE_TONE[type],
      )}
    >
      <Icon className="size-3" /> {type === 'INTERNAL' ? 'Transfer' : type.toLowerCase()}
    </span>
  );
}

/** Start/end of a yyyy-mm-dd day in local time, as ISO strings for the API. */
const dayStart = (d: string) => new Date(`${d}T00:00:00`).toISOString();
const dayEnd = (d: string) => new Date(`${d}T23:59:59.999`).toISOString();

export function MovesPage() {
  const [params, setParams] = useSearchParams();
  const [check, setCheck] = useState<Integrity | null>(null);
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);

  const get = (k: string) => params.get(k) ?? undefined;
  const filters = {
    productId: get('productId'),
    locationId: get('locationId'),
    type: get('type'),
    search: get('search'),
    from: get('from') ? dayStart(get('from')!) : undefined,
    to: get('to') ? dayEnd(get('to')!) : undefined,
  };
  const page = Number(params.get('page')) || 1;
  const pageSize = Number(params.get('size')) || 15;
  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const moves = useMoves({ ...filters, page, pageSize });
  const { data: productPage } = useProducts({ page: 1, pageSize: 100 });
  const { data: locations = [] } = useLocations({ includeVirtual: true });

  async function runCheck() {
    setChecking(true);
    try {
      const r = await api.get<Integrity>('/moves/integrity-check');
      setCheck(r);
      if (r.balanced) toast.success(`Ledger balanced: ${fmtInt(r.movesChecked)} moves verified`);
      else toast.error(`${r.discrepancies.length} discrepancies found`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await api.blob('/moves/export.csv', filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-moves-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<Move>[] = [
    {
      key: 'ts',
      header: 'Timestamp',
      cell: (m) => (
        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
          {fmtDateTime(m.createdAt)}
        </span>
      ),
    },
    {
      key: 'ref',
      header: 'Reference',
      cell: (m) =>
        m.operation ? (
          m.operation.type === 'ADJUSTMENT' ? (
            <span className="font-mono text-[13px] font-semibold whitespace-nowrap text-plum-nav">
              {m.operation.reference}
            </span>
          ) : (
            <Link
              to={`${OP_META[m.operation.type].path}/${m.operation.id}`}
              className="font-mono text-[13px] font-semibold whitespace-nowrap text-plum-nav hover:underline"
            >
              {m.operation.reference}
            </Link>
          )
        ) : (
          '—'
        ),
    },
    {
      key: 'type',
      header: 'Type',
      hideBelow: 'md',
      cell: (m) => (m.operation ? <TypeBadge type={m.operation.type} /> : null),
    },
    {
      key: 'product',
      header: 'Product & SKU',
      cell: (m) => (
        <Link to={`/products/${m.product.id}`} className="block min-w-36 hover:underline">
          <span className="font-medium text-ink">{m.product.name}</span>
          <span className="block font-mono text-xs text-muted-foreground">{m.product.sku}</span>
        </Link>
      ),
    },
    { key: 'qty', header: 'Qty', align: 'right', cell: (m) => <MoveQty move={m} /> },
    { key: 'route', header: 'From → To', hideBelow: 'lg', cell: (m) => <MoveRoute move={m} /> },
    {
      key: 'user',
      header: 'By',
      hideBelow: '2xl',
      cell: (m) => <span className="whitespace-nowrap">{m.user.name}</span>,
    },
  ];

  const anyFilter = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Inventory' }, { label: 'Move History' }]}
        title="Move History"
        subtitle="Append-only ledger of every stock movement. Moves are never edited or deleted."
        actions={
          <>
            <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />} Export CSV
            </Button>
            <Button onClick={() => void runCheck()} disabled={checking}>
              {checking ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Run integrity
              check
            </Button>
          </>
        }
      />

      {check && (
        <div
          role="status"
          className={cn(
            'mb-4 rounded-lg border p-4',
            check.balanced ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5',
          )}
        >
          <p
            className={cn(
              'flex items-center gap-2 font-semibold',
              check.balanced ? 'text-success' : 'text-danger',
            )}
          >
            {!check.balanced && <AlertTriangle className="size-5" />}
            {check.balanced
              ? '✅ Ledger balanced'
              : `${check.discrepancies.length} discrepanc${check.discrepancies.length === 1 ? 'y' : 'ies'} found`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Recomputed {fmtInt(check.quantsChecked)} stock balances from{' '}
            {fmtInt(check.movesChecked)} raw moves · checked {fmtDateTime(check.checkedAt)}
          </p>
          {!check.balanced && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-divider bg-canvas">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-divider bg-deck text-left text-label text-muted-foreground uppercase">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2 text-right">Ledger</th>
                    <th className="px-3 py-2 text-right">Stored</th>
                    <th className="px-3 py-2 text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {check.discrepancies.map((d, i) => (
                    <tr key={i} className="border-b border-divider last:border-0">
                      <td className="px-3 py-2">
                        {d.product.name}{' '}
                        <span className="font-mono text-xs text-muted-foreground">
                          {d.product.sku}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{d.location.fullName}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtQty(d.ledgerQty)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtQty(d.quantQty)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-danger">
                        {fmtQty(d.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="mb-4 grid gap-3 rounded-lg border border-divider bg-canvas p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3.5" /> From
          </span>
          <Input
            type="date"
            value={get('from') ?? ''}
            onChange={(e) => set({ from: e.target.value || undefined })}
            className="h-10"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          <span>To</span>
          <Input
            type="date"
            value={get('to') ?? ''}
            onChange={(e) => set({ to: e.target.value || undefined })}
            className="h-10"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Product
          <FilterSelect
            ariaLabel="Product"
            className="w-full"
            value={filters.productId}
            onChange={(v) => set({ productId: v })}
            allLabel="All products"
            options={(productPage?.items ?? []).map((p) => ({
              value: String(p.id),
              label: p.name,
            }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Location
          <FilterSelect
            ariaLabel="Location"
            className="w-full"
            value={filters.locationId}
            onChange={(v) => set({ locationId: v })}
            allLabel="All locations"
            options={locations.map((l) => ({ value: String(l.id), label: l.fullName }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Operation type
          <FilterSelect
            ariaLabel="Operation type"
            className="w-full"
            value={filters.type}
            onChange={(v) => set({ type: v })}
            allLabel="All types"
            options={(['RECEIPT', 'DELIVERY', 'INTERNAL', 'ADJUSTMENT'] as const).map((t) => ({
              value: t,
              label: OP_META[t].plural,
            }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Search
          <span className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              key={filters.search}
              defaultValue={filters.search}
              placeholder="Reference, SKU, product"
              onKeyDown={(e) =>
                e.key === 'Enter' && set({ search: e.currentTarget.value.trim() || undefined })
              }
              onBlur={(e) =>
                e.target.value.trim() !== (filters.search ?? '') &&
                set({ search: e.target.value.trim() || undefined })
              }
              className="h-10 w-full rounded-lg border border-divider bg-canvas pr-3 pl-9 text-sm text-ink outline-none focus:border-plum focus:ring-[3px] focus:ring-plum/25"
            />
          </span>
        </label>
        {anyFilter && (
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-6">
            <Button
              variant="link"
              className="text-sm"
              onClick={() => setParams({}, { replace: true })}
            >
              Reset all filters
            </Button>
          </div>
        )}
      </div>

      <Panel>
        <SectionHeaderBar
          icon={History}
          title="Stock ledger"
          badge={moves.data ? `${fmtInt(moves.data.total)} movements` : undefined}
        />
        {moves.error ? (
          <ErrorState error={moves.error} onRetry={() => void moves.refetch()} />
        ) : (
          <DataTable
            className="rounded-t-none border-0"
            columns={columns}
            rows={moves.data?.items}
            rowKey={(m) => m.id}
            loading={moves.isLoading}
            empty={
              <EmptyState
                icon={History}
                title={anyFilter ? 'No moves match these filters' : 'No stock movements yet'}
                description={
                  anyFilter
                    ? 'Widen the date range or clear filters.'
                    : 'Validate a receipt to write the first ledger entry.'
                }
              />
            }
            footer={
              moves.data && (
                <div className="flex flex-wrap items-center border-t border-divider bg-deck">
                  <label className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                    Rows
                    <select
                      value={pageSize}
                      onChange={(e) => set({ size: e.target.value })}
                      className="h-8 rounded-md border border-divider bg-canvas px-2 text-ink"
                    >
                      {[15, 25, 50, 100].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex-1 [&>div]:border-0">
                    <Pagination
                      page={moves.data.page}
                      pageSize={moves.data.pageSize}
                      total={moves.data.total}
                      onPage={(p) => set({ page: String(p) })}
                      noun="moves"
                    />
                  </div>
                </div>
              )
            }
          />
        )}
      </Panel>

      <div className="mt-4 flex items-start gap-3 rounded-lg border border-divider bg-canvas p-4 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-plum" />
        <p className="text-muted-foreground">
          <b className="text-ink">Append-only guarantee.</b> A database trigger rejects any update
          or delete on ledger rows. Mistakes are corrected with a counter-balancing adjustment, so
          history is never rewritten.
        </p>
      </div>
    </>
  );
}
