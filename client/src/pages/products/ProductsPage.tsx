import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Eye,
  MoreVertical,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable, Pagination, type Column } from '@/components/common/DataTable';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState } from '@/components/common/States';
import { StockBadge } from '@/components/common/StatusPill';
import { STOCK_LABEL, stockTone } from '@/lib/stock';
import { useApiMutation, useCategories, useProducts } from '@/hooks/useMasterData';
import { api } from '@/lib/api';
import { fmtQty, plural } from '@/lib/format';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth';
import { useWarehouse } from '@/providers/warehouse';
import { CategoriesDialog } from './CategoriesDialog';

function StockLevel({ p }: { p: Product }) {
  // Scale so the reorder minimum sits at one third of the bar.
  const scale = Math.max(p.reorderMin * 3, p.onHand, 1);
  const pct = Math.min(100, (p.onHand / scale) * 100);
  return (
    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-deck" aria-hidden>
      <div
        className={cn(
          'h-full rounded-full',
          p.stockStatus === 'IN_STOCK'
            ? 'bg-chart-in'
            : p.stockStatus === 'LOW'
              ? 'bg-warning'
              : 'bg-danger',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProductsPage() {
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const { warehouses, warehouseId: globalWh } = useWarehouse();
  const [params, setParams] = useSearchParams();
  const [catsOpen, setCatsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const search = params.get('search') ?? '';
  const categoryId = Number(params.get('categoryId')) || undefined;
  const stockStatus = params.get('status') ?? undefined;
  const whParam = params.get('warehouseId');
  const warehouseId = whParam === 'all' ? null : Number(whParam) || globalWh;
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

  const { data: categories = [] } = useCategories();
  const { data, isLoading, isFetching, error, refetch } = useProducts({
    search: search || undefined,
    categoryId,
    stockStatus,
    warehouseId,
    page,
  });
  const remove = useApiMutation((id: number) => api.delete(`/products/${id}`), {
    success: 'Product deleted',
    invalidate: ['products'],
  });

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      cell: (p) => (
        <div className="min-w-44">
          <Link
            to={`/products/${p.id}`}
            className="font-medium text-ink hover:text-plum-nav hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {p.name}
          </Link>
          <p className="text-xs text-muted-foreground">{p.category.name}</p>
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      cell: (p) => <span className="font-mono text-[13px] text-muted-foreground">{p.sku}</span>,
    },
    { key: 'uom', header: 'UoM', cell: (p) => p.uom, hideBelow: 'md' },
    {
      key: 'onHand',
      header: 'On hand',
      align: 'right',
      cell: (p) => (
        <span
          className={cn(
            'font-mono text-[13px] font-semibold whitespace-nowrap',
            stockTone[p.stockStatus],
          )}
        >
          {fmtQty(p.onHand)} {p.uom}
        </span>
      ),
    },
    {
      key: 'reorder',
      header: 'Reorder at',
      align: 'right',
      hideBelow: 'lg',
      cell: (p) => (
        <span className="font-mono text-[13px] whitespace-nowrap text-muted-foreground">
          {fmtQty(p.reorderMin)} {p.uom}
        </span>
      ),
    },
    { key: 'level', header: 'Stock level', hideBelow: 'lg', cell: (p) => <StockLevel p={p} /> },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      cell: (p) => <StockBadge status={p.stockStatus} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${p.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => navigate(`/products/${p.id}`)}>
              <Eye /> View details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(`/adjustments?productId=${p.id}`)}>
              <SlidersHorizontal /> Adjust stock
            </DropdownMenuItem>
            {isManager && (
              <>
                <DropdownMenuItem onSelect={() => navigate(`/products/${p.id}/edit`)}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-danger focus:text-danger"
                  onSelect={() => setToDelete(p)}
                >
                  <Trash2 className="text-danger" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filtered = !!(search || categoryId || stockStatus);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Inventory' }, { label: 'Products' }]}
        title={
          <span className="flex items-center gap-3">
            Products
            {data && (
              <span className="rounded-full bg-plum-tint px-2.5 py-0.5 font-sans text-sm font-semibold text-plum">
                {plural(data.total, 'item')}
              </span>
            )}
          </span>
        }
        actions={
          isManager && (
            <>
              <Button variant="outline" onClick={() => setCatsOpen(true)}>
                <Tags /> Categories
              </Button>
              <Button asChild>
                <Link to="/products/new">
                  <Plus /> New product
                </Link>
              </Button>
            </>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-divider bg-canvas p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            key={search}
            defaultValue={search}
            onKeyDown={(e) => {
              if (e.key === 'Enter') set({ search: e.currentTarget.value.trim() || undefined });
            }}
            onBlur={(e) => {
              if (e.target.value.trim() !== search)
                set({ search: e.target.value.trim() || undefined });
            }}
            placeholder="Search by name or SKU…"
            aria-label="Search by name or SKU"
            className="h-10 w-full rounded-lg border border-divider bg-deck pr-3 pl-9 text-sm outline-none focus:border-plum focus:bg-canvas focus:ring-[3px] focus:ring-plum/25"
          />
        </div>
        <FilterSelect
          ariaLabel="Category"
          value={categoryId ? String(categoryId) : undefined}
          onChange={(v) => set({ categoryId: v })}
          allLabel="All categories"
          options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
        />
        <FilterSelect
          ariaLabel="Stock status"
          value={stockStatus}
          onChange={(v) => set({ status: v })}
          allLabel="Any stock status"
          options={(['IN_STOCK', 'LOW', 'OUT'] as const).map((s) => ({
            value: s,
            label: STOCK_LABEL[s],
          }))}
        />
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
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(p) => p.id}
          loading={isLoading}
          onRowClick={(p) => navigate(`/products/${p.id}`)}
          className={cn(isFetching && !isLoading && 'opacity-70 transition-opacity')}
          empty={
            <EmptyState
              icon={Package}
              title={filtered ? 'No products match these filters' : 'No products yet'}
              description={
                filtered
                  ? 'Try a different search or clear the filters.'
                  : 'Add your first product to start tracking stock.'
              }
              action={
                filtered ? (
                  <Button variant="outline" onClick={() => setParams({}, { replace: true })}>
                    Clear filters
                  </Button>
                ) : (
                  isManager && (
                    <Button asChild>
                      <Link to="/products/new">
                        <Plus /> New product
                      </Link>
                    </Button>
                  )
                )
              }
            />
          }
          footer={
            data && (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={(p) => set({ page: String(p) })}
                noun="products"
              />
            )
          }
        />
      )}

      <CategoriesDialog open={catsOpen} onOpenChange={setCatsOpen} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? 'product'}?`}
        description="Products with stock history can't be deleted, because the ledger must stay intact."
        confirmLabel="Delete product"
        tone="danger"
        busy={remove.isPending}
        onConfirm={() =>
          toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      />
    </>
  );
}
