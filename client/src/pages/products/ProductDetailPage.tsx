import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlarmClock,
  ArrowLeftRight,
  Boxes,
  CalendarClock,
  Download,
  History,
  PackageOpen,
  Pencil,
  Plus,
  SlidersHorizontal,
  TrendingDown,
  Warehouse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type Column } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel, SectionHeaderBar } from '@/components/common/SectionHeaderBar';
import { EmptyState, ErrorState } from '@/components/common/States';
import { StockBadge } from '@/components/common/StatusPill';
import { MoveQty, MoveRoute } from '@/components/common/MoveBits';
import { LogoMark, Wordmark } from '@/components/common/Logo';
import { useMoves, useProductStock } from '@/hooks/useMasterData';
import { fmtDateTime, fmtQty } from '@/lib/format';
import { downloadDataUrl, renderLabelPng, skuQrDataUrl } from '@/lib/label';
import type { Move } from '@/lib/types';
import { useAuth } from '@/providers/auth';

function Kpi({
  label,
  icon,
  value,
  unit,
  note,
}: {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
}) {
  return (
    <div className="border-divider p-5 not-last:border-b sm:not-last:border-r sm:not-last:border-b-0">
      <div className="flex items-center justify-between text-label font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
        <span className="text-plum">{icon}</span>
      </div>
      <p className="mt-3 font-mono text-[28px] font-semibold text-ink">
        {value}
        {unit && (
          <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">{unit}</span>
        )}
      </p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function ProductDetailPage() {
  const id = Number(useParams().id);
  const { isManager } = useAuth();
  const { data, isLoading, error, refetch } = useProductStock(id);
  const moves = useMoves({ productId: id, pageSize: 8 });
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (data) void skuQrDataUrl(data.product.sku, 220).then(setQr);
  }, [data]);

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (isLoading || !data) {
    return (
      <div className="min-w-0 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const p = data.product;
  const moveColumns: Column<Move>[] = [
    {
      key: 'ts',
      header: 'Timestamp',
      cell: (m) => (
        <span className="font-mono text-[13px] whitespace-nowrap">{fmtDateTime(m.createdAt)}</span>
      ),
    },
    { key: 'qty', header: 'Quantity', align: 'right', cell: (m) => <MoveQty move={m} /> },
    { key: 'route', header: 'Route (from → to)', cell: (m) => <MoveRoute move={m} /> },
    {
      key: 'ref',
      header: 'Reference',
      hideBelow: 'md',
      cell: (m) =>
        m.operation ? (
          <span className="font-mono text-[13px] text-plum-nav">{m.operation.reference}</span>
        ) : (
          '—'
        ),
    },
    { key: 'user', header: 'Operator', hideBelow: 'lg', cell: (m) => m.user.name },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Inventory' }, { label: 'Products', to: '/products' }, { label: p.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {p.name}
            <StockBadge status={p.stockStatus} />
            <span className="rounded-md bg-plum-tint px-2 py-0.5 font-sans text-xs font-semibold text-plum">
              {p.category.name}
            </span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              SKU:{' '}
              <span className="rounded border border-divider bg-deck px-1.5 py-0.5 font-mono text-xs text-ink">
                {p.sku}
              </span>
            </span>
            <span>
              Unit: <b className="font-medium text-ink">{p.uom}</b>
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="warning" asChild>
              <Link to={`/adjustments?productId=${p.id}`}>
                <SlidersHorizontal /> Adjust stock
              </Link>
            </Button>
            {isManager && (
              <Button variant="outline" asChild>
                <Link to={`/products/${p.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link to={`/receipts/new?productId=${p.id}&qty=${p.reorderQty || ''}`}>
                <Plus /> Create receipt
              </Link>
            </Button>
          </>
        }
      />

      <Panel className="mb-6 grid sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="On hand"
          icon={<Boxes className="size-4" />}
          value={fmtQty(data.total)}
          unit={p.uom}
          note={`across ${data.locations.length} location${data.locations.length === 1 ? '' : 's'}`}
        />
        <Kpi
          label="Reorder at"
          icon={<AlarmClock className="size-4" />}
          value={fmtQty(p.reorderMin)}
          unit={p.uom}
          note={
            data.total > p.reorderMin ? (
              <span className="text-success">
                Healthy (+{fmtQty(data.total - p.reorderMin)} buffer)
              </span>
            ) : (
              <span className="text-warning">
                Below minimum: reorder {fmtQty(p.reorderQty)} {p.uom}
              </span>
            )
          }
        />
        <Kpi
          label="Avg daily out"
          icon={<TrendingDown className="size-4" />}
          value={fmtQty(data.avgDailyOut)}
          unit={p.uom}
          note="Trailing 14-day velocity"
        />
        <Kpi
          label="Days of stock"
          icon={<CalendarClock className="size-4" />}
          value={data.daysLeft === null ? '—' : `~${data.daysLeft}`}
          unit={data.daysLeft === null ? undefined : 'days'}
          note={
            data.daysLeft === null
              ? 'No outflow in 14 days'
              : `Est. depletion ${new Date(Date.now() + data.daysLeft * 86_400_000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
          }
        />
      </Panel>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Panel>
          <SectionHeaderBar
            icon={Warehouse}
            title="Stock by location"
            badge={`${data.locations.length} active`}
          />
          {data.locations.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="No stock on hand"
              description="Receive this product or record a count to put it on a shelf."
              action={
                <Button asChild>
                  <Link to={`/receipts/new?productId=${p.id}&qty=${p.reorderQty || ''}`}>
                    <Plus /> Create receipt
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3 p-5">
              {data.locations.map((l) => {
                const pct = data.total ? (l.quantity / data.total) * 100 : 0;
                return (
                  <li key={l.location.id} className="rounded-lg border border-divider p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-ink">
                        {l.location.fullName.replaceAll('/', ' / ')}
                      </span>
                      <span className="font-mono text-sm">
                        <b>{fmtQty(l.quantity)}</b> {p.uom}{' '}
                        <span className="text-muted-foreground">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-deck">
                      <div
                        className="h-full rounded-full bg-chart-in"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
              <li className="flex flex-wrap items-center justify-between gap-2 border-t border-divider pt-4 text-sm text-muted-foreground">
                <span>
                  Total {fmtQty(data.total)} {p.uom} across all internal locations
                </span>
                <Link
                  to={`/transfers/new?productId=${p.id}`}
                  className="flex items-center gap-1.5 font-medium text-link hover:underline"
                >
                  <ArrowLeftRight className="size-4" /> Initiate internal transfer
                </Link>
              </li>
            </ul>
          )}
        </Panel>

        <Panel className="p-6">
          <h3 className="mb-4 border-b border-divider pb-3 font-display text-headline-sm font-semibold">
            Product label
          </h3>
          <div className="rounded-lg border border-divider bg-white p-4 text-center">
            <p className="logo-on-light mb-2 flex items-center gap-1.5">
              <LogoMark className="size-5" />
              <Wordmark className="text-sm" />
            </p>
            {qr ? (
              <img src={qr} alt={`QR code for ${p.sku}`} className="mx-auto size-36" />
            ) : (
              <Skeleton className="mx-auto size-36" />
            )}
            <p className="mt-2 font-mono text-base font-semibold tracking-widest text-black">
              {p.sku}
            </p>
            <p className="text-sm text-black">{p.name}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              onClick={async () =>
                downloadDataUrl(
                  await renderLabelPng({
                    sku: p.sku,
                    name: p.name,
                    uom: p.uom,
                    category: p.category.name,
                  }),
                  `label-${p.sku}.png`,
                )
              }
            >
              <Download /> Label
            </Button>
            <Button
              variant="outline"
              disabled={!qr}
              onClick={() => qr && downloadDataUrl(qr, `qr-${p.sku}.png`)}
            >
              <Download /> QR only
            </Button>
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionHeaderBar
          icon={History}
          title="Movement history"
          actions={
            <Link
              to={`/moves?productId=${p.id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              View full ledger →
            </Link>
          }
        />
        <DataTable
          className="rounded-t-none border-0"
          columns={moveColumns}
          rows={moves.data?.items}
          rowKey={(m) => m.id}
          loading={moves.isLoading}
          empty={
            <EmptyState
              icon={History}
              title="No movements yet"
              description="Validated operations for this product will appear here."
            />
          }
        />
      </Panel>
    </>
  );
}
