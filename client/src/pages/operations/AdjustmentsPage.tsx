import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  History,
  Loader2,
  NotebookPen,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, Pagination, type Column } from '@/components/common/DataTable';
import { FilterSelect } from '@/components/common/FilterSelect';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel, SectionHeaderBar } from '@/components/common/SectionHeaderBar';
import { EmptyState } from '@/components/common/States';
import { MoveQty } from '@/components/common/MoveBits';
import { useLocations, useMoves, useProducts, useProductStock } from '@/hooks/useMasterData';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, fmtQty } from '@/lib/format';
import type { Move } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

const REASONS = [
  'Cycle count',
  'Damaged',
  'Found in count',
  'Scrap',
  'Theft / missing',
  'Data entry correction',
  'Opening stock',
];

type AdjustResult = {
  previousQty: number;
  countedQty: number;
  difference: number;
  operation: { reference: string } | null;
  message: string;
};

export function AdjustmentsPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [productId, setProductId] = useState<string | undefined>(
    params.get('productId') ?? undefined,
  );
  const [locationId, setLocationId] = useState<string | undefined>(
    params.get('locationId') ?? undefined,
  );
  const [counted, setCounted] = useState('');
  const [reason, setReason] = useState<string | undefined>('Cycle count');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  const { data: productPage } = useProducts({ page: 1, pageSize: 100 });
  const products = useMemo(() => productPage?.items ?? [], [productPage]);
  const { data: locations = [] } = useLocations();
  const stock = useProductStock(Number(productId) || 0);
  const log = useMoves({ type: 'ADJUSTMENT', page, pageSize: 10 });

  const product = products.find((p) => String(p.id) === productId);
  const location = locations.find((l) => String(l.id) === locationId);
  const recorded =
    productId && locationId && stock.data
      ? (stock.data.locations.find((l) => String(l.location.id) === locationId)?.quantity ?? 0)
      : null;
  const countedNum = counted === '' ? null : Number(counted);
  const valid = countedNum !== null && Number.isFinite(countedNum) && countedNum >= 0;
  const diff =
    valid && recorded !== null ? Math.round((countedNum - recorded) * 1000) / 1000 : null;

  async function apply() {
    if (!productId || !locationId || !valid) return;
    setBusy(true);
    try {
      const reasonText = [reason, notes.trim()].filter(Boolean).join(': ') || null;
      const res = await api.post<AdjustResult>('/adjustments', {
        productId: Number(productId),
        locationId: Number(locationId),
        countedQty: countedNum,
        reason: reasonText,
      });
      if (res.operation)
        toast.success(
          `${res.operation.reference}: ${res.difference > 0 ? '+' : ''}${fmtQty(res.difference)} ${product?.uom ?? ''} booked`,
        );
      else toast.info('Count matches the records. No adjustment needed.');
      setCounted('');
      setNotes('');
      await Promise.all(
        ['products', 'moves', 'dashboard', 'locations', 'operations'].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Move>[] = [
    {
      key: 'ref',
      header: 'Reference',
      cell: (m) => (
        <span className="font-mono text-[13px] font-semibold text-plum-nav">
          {m.operation?.reference}
        </span>
      ),
    },
    {
      key: 'product',
      header: 'Product & SKU',
      cell: (m) => (
        <Link to={`/products/${m.product.id}`} className="block hover:underline">
          <span className="font-medium text-ink">{m.product.name}</span>
          <span className="block font-mono text-xs text-muted-foreground">{m.product.sku}</span>
        </Link>
      ),
    },
    {
      key: 'loc',
      header: 'Location',
      hideBelow: 'md',
      cell: (m) => (
        <span className="font-mono text-xs">
          {(m.fromLoc.type === 'INTERNAL' ? m.fromLoc : m.toLoc).fullName}
        </span>
      ),
    },
    { key: 'var', header: 'Variance', align: 'right', cell: (m) => <MoveQty move={m} /> },
    {
      key: 'reason',
      header: 'Reason',
      hideBelow: 'lg',
      cell: (m) =>
        m.operation?.notes ? (
          <span className="rounded-full bg-deck px-2.5 py-0.5 text-xs">{m.operation.notes}</span>
        ) : (
          '—'
        ),
    },
    { key: 'by', header: 'Counted by', hideBelow: 'lg', cell: (m) => m.user.name },
    {
      key: 'at',
      header: 'Date',
      align: 'right',
      cell: (m) => (
        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
          {fmtDateTime(m.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Operations' }, { label: 'Adjustments' }]}
        title="Inventory adjustment"
        subtitle="Reconcile physical counts with the ledger. The difference is booked against Inventory Loss."
      />

      <Panel className="mx-auto mb-8 max-w-4xl">
        <SectionHeaderBar icon={NotebookPen} title="New count" />
        <div className="space-y-6 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Product">
              <FilterSelect
                ariaLabel="Product"
                className="h-[42px] w-full"
                value={productId}
                onChange={setProductId}
                options={products.map((p) => ({
                  value: String(p.id),
                  label: `${p.name} · ${p.sku}`,
                }))}
              />
            </FormField>
            <FormField label="Location">
              <FilterSelect
                ariaLabel="Location"
                className="h-[42px] w-full font-mono text-[13px]"
                value={locationId}
                onChange={setLocationId}
                options={locations.map((l) => ({ value: String(l.id), label: l.fullName }))}
              />
            </FormField>
          </div>

          <div className="grid gap-4 rounded-lg bg-deck p-4 sm:grid-cols-3">
            <div className="rounded-lg border border-divider bg-canvas p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                System recorded
              </p>
              <p className="mt-2 font-mono text-[28px] font-semibold">
                {recorded === null ? '—' : fmtQty(recorded)}{' '}
                <span className="font-sans text-sm font-normal text-muted-foreground">
                  {product?.uom}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {recorded === null ? 'Pick a product and location' : 'Current quant in the ledger'}
              </p>
            </div>
            <label className="rounded-lg border-2 border-plum bg-canvas p-4">
              <span className="text-xs font-semibold tracking-wide text-plum uppercase">
                Physical count
              </span>
              <span className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={counted}
                  onChange={(e) => setCounted(e.target.value)}
                  disabled={recorded === null}
                  className="h-11 font-mono text-xl"
                  aria-label="Counted quantity"
                />
                <span className="text-sm text-muted-foreground">{product?.uom}</span>
              </span>
            </label>
            <div
              className={cn(
                'rounded-lg border p-4',
                diff === null || diff === 0
                  ? 'border-divider bg-canvas'
                  : diff < 0
                    ? 'border-danger/30 bg-danger/5'
                    : 'border-success/30 bg-success/5',
              )}
            >
              <p
                className={cn(
                  'text-xs font-semibold tracking-wide uppercase',
                  diff && diff < 0
                    ? 'text-danger'
                    : diff && diff > 0
                      ? 'text-success'
                      : 'text-muted-foreground',
                )}
              >
                Variance
              </p>
              <p
                className={cn(
                  'mt-2 font-mono text-[28px] font-semibold',
                  diff && diff < 0 ? 'text-danger' : diff && diff > 0 ? 'text-success' : 'text-ink',
                )}
              >
                {diff === null ? '—' : `${diff > 0 ? '+' : ''}${fmtQty(diff)}`}{' '}
                <span className="font-sans text-sm font-normal text-muted-foreground">
                  {product?.uom}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {diff === null
                  ? 'Enter the counted quantity'
                  : diff === 0
                    ? 'Matches the records'
                    : diff < 0
                      ? 'Deficit identified'
                      : 'Surplus found'}
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Reason">
              <FilterSelect
                ariaLabel="Reason"
                className="h-[42px] w-full"
                value={reason}
                onChange={setReason}
                options={REASONS.map((r) => ({ value: r, label: r }))}
              />
            </FormField>
            <FormField label="Notes" htmlFor="adj-notes">
              <Input
                id="adj-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional details"
                maxLength={150}
              />
            </FormField>
          </div>

          {diff !== null && diff !== 0 && location && (
            <div className="flex items-start gap-3 rounded-lg border border-divider bg-deck p-4 text-sm">
              <ClipboardList className="mt-0.5 size-4 shrink-0 text-plum" />
              <p>
                Journal action:{' '}
                <span className="inline-flex flex-wrap items-center gap-1 font-mono text-xs">
                  {diff < 0 ? location.fullName : 'Inventory Loss'}{' '}
                  <ArrowRight className="size-3" />{' '}
                  {diff < 0 ? 'Inventory Loss' : location.fullName}
                </span>{' '}
                <span
                  className={cn(
                    'font-mono text-xs font-semibold',
                    diff < 0 ? 'text-danger' : 'text-success',
                  )}
                >
                  ({diff > 0 ? '+' : ''}
                  {fmtQty(diff)} {product?.uom})
                </span>
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider bg-deck px-6 py-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4" /> Recorded in the ledger as {user?.name}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => (setCounted(''), setNotes(''))}
              disabled={busy}
            >
              Reset
            </Button>
            <Button onClick={() => void apply()} disabled={busy || !valid || recorded === null}>
              {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Apply adjustment
            </Button>
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionHeaderBar
          icon={History}
          title="Recent adjustments"
          badge={log.data ? `${log.data.total} entries` : undefined}
        />
        <DataTable
          className="rounded-t-none border-0"
          columns={columns}
          rows={log.data?.items}
          rowKey={(m) => m.id}
          loading={log.isLoading}
          empty={
            <EmptyState
              icon={History}
              title="No adjustments yet"
              description="Counts you apply above will appear here."
            />
          }
          footer={
            log.data && (
              <Pagination
                page={log.data.page}
                pageSize={log.data.pageSize}
                total={log.data.total}
                onPage={setPage}
                noun="adjustments"
              />
            )
          }
        />
      </Panel>
    </>
  );
}
