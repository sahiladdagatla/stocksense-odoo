import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  Grid2x2,
  Loader2,
  Lock,
  Network,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  Warehouse as WarehouseIcon,
  PackageX,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel, SectionHeaderBar } from '@/components/common/SectionHeaderBar';
import { EmptyState, ErrorState } from '@/components/common/States';
import { useApiMutation, useLocations, useLocationTree } from '@/hooks/useMasterData';
import { api } from '@/lib/api';
import { fmtQty } from '@/lib/format';
import type { LocationNode, Warehouse, WarehouseTree } from '@/lib/types';
import { useAuth } from '@/providers/auth';

const subtreeUnits = (n: LocationNode): number =>
  n.onHand + n.children.reduce((a, c) => a + subtreeUnits(c), 0);
const countNodes = (ns: LocationNode[]): number =>
  ns.reduce((a, n) => a + 1 + countNodes(n.children), 0);

/* ---------- dialogs ---------- */

function WarehouseDialog({
  open,
  onOpenChange,
  warehouse,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  warehouse: Warehouse | null;
}) {
  const [form, setForm] = useState({ name: '', code: '', address: '' });
  useEffect(() => {
    if (open)
      setForm({
        name: warehouse?.name ?? '',
        code: warehouse?.code ?? '',
        address: warehouse?.address ?? '',
      });
  }, [open, warehouse]);
  const save = useApiMutation(
    () =>
      warehouse
        ? api.patch(`/warehouses/${warehouse.id}`, {
            name: form.name,
            address: form.address || null,
          })
        : api.post('/warehouses', {
            name: form.name,
            code: form.code,
            address: form.address || null,
          }),
    {
      success: warehouse ? 'Warehouse updated' : 'Warehouse created',
      invalidate: ['warehouses', 'locations'],
    },
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(undefined, { onSuccess: () => onOpenChange(false) });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display">
              {warehouse ? `Edit ${warehouse.code}` : 'New warehouse'}
            </DialogTitle>
            <DialogDescription>
              {warehouse
                ? 'The code is fixed because it prefixes every location path and document reference.'
                : 'The short code (e.g. WH3) prefixes locations and references.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[110px_1fr] gap-3">
            <FormField label="Code" htmlFor="wh-code" required>
              <Input
                id="wh-code"
                className="font-mono uppercase"
                value={form.code}
                disabled={!!warehouse}
                maxLength={8}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </FormField>
            <FormField label="Name" htmlFor="wh-name" required>
              <Input
                id="wh-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Address" htmlFor="wh-address">
            <Input
              id="wh-address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={save.isPending || !form.name.trim() || (!warehouse && form.code.length < 2)}
            >
              {save.isPending && <Loader2 className="animate-spin" />}
              {warehouse ? 'Save' : 'Create warehouse'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type LocDialogState =
  | { mode: 'create'; warehouse: WarehouseTree; parent: LocationNode | null }
  | { mode: 'rename'; node: LocationNode }
  | null;

function LocationDialog({ state, onClose }: { state: LocDialogState; onClose: () => void }) {
  const [name, setName] = useState('');
  useEffect(() => setName(state?.mode === 'rename' ? state.node.name : ''), [state]);
  const save = useApiMutation(
    () => {
      if (!state) return Promise.resolve();
      return state.mode === 'rename'
        ? api.patch(`/locations/${state.node.id}`, { name })
        : api.post('/locations', {
            name,
            warehouseId: state.warehouse.id,
            parentId: state.parent?.id ?? null,
          });
    },
    {
      success: state?.mode === 'rename' ? 'Location renamed' : 'Location added',
      invalidate: ['locations', 'products'],
    },
  );
  const prefix =
    state?.mode === 'create'
      ? `${state.parent?.fullName ?? state.warehouse.code}/`
      : state?.mode === 'rename'
        ? state.node.fullName.slice(0, -state.node.name.length)
        : '';
  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(undefined, { onSuccess: onClose });
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              {state?.mode === 'rename'
                ? 'Rename location'
                : state?.parent
                  ? 'Add sub-location'
                  : 'Add root location'}
            </DialogTitle>
            <DialogDescription>
              Full path:{' '}
              <span className="font-mono text-ink">
                {prefix}
                {name || '…'}
              </span>
            </DialogDescription>
          </DialogHeader>
          <FormField label="Name" htmlFor="loc-name" required hint="e.g. Rack C, Cold Room, Dock 2">
            <Input
              id="loc-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.replace('/', ''))}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- tree ---------- */

function TreeRow({
  node,
  depth,
  warehouse,
  collapsed,
  toggle,
  filter,
  onAction,
  canEdit,
}: {
  node: LocationNode;
  depth: number;
  warehouse: WarehouseTree;
  collapsed: Set<number>;
  toggle: (id: number) => void;
  filter: string;
  onAction: (a: { kind: 'add' | 'rename' | 'delete'; node: LocationNode }) => void;
  canEdit: boolean;
}) {
  const matches = (n: LocationNode): boolean =>
    n.fullName.toLowerCase().includes(filter) || n.children.some(matches);
  if (filter && !matches(node)) return null;
  const open = !collapsed.has(node.id) || !!filter;
  const Icon = node.children.length ? FolderOpen : Grid2x2;
  return (
    <li>
      <div
        className="group flex min-h-11 items-center gap-2 rounded-lg pr-2 hover:bg-row-hover"
        style={{ paddingLeft: depth * 24 + 8 }}
      >
        {node.children.length ? (
          <button
            onClick={() => toggle(node.id)}
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-deck"
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="w-6" />
        )}
        <Icon className="size-4 text-plum" aria-hidden />
        <span className="font-medium text-ink">{node.name}</span>
        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
          {node.fullName}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {canEdit && (
            <span className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onAction({ kind: 'add', node })}
              >
                <Plus className="size-3.5" /> Sub-location
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="size-7"
                aria-label={`Rename ${node.name}`}
                onClick={() => onAction({ kind: 'rename', node })}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost-danger"
                className="size-7"
                aria-label={`Delete ${node.name}`}
                onClick={() => onAction({ kind: 'delete', node })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </span>
          )}
          <span className="w-24 text-right font-mono text-xs text-muted-foreground">
            {fmtQty(subtreeUnits(node))} units
          </span>
        </span>
      </div>
      {open && node.children.length > 0 && (
        <ul className="border-l border-divider" style={{ marginLeft: depth * 24 + 20 }}>
          {node.children.map((c) => (
            <TreeRow
              key={c.id}
              node={c}
              depth={0}
              warehouse={warehouse}
              collapsed={collapsed}
              toggle={toggle}
              filter={filter}
              onAction={onAction}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ---------- page ---------- */

const VIRTUAL_META = {
  VENDOR: { icon: Truck, text: 'Where received stock comes from' },
  CUSTOMER: { icon: ShoppingCart, text: 'Where delivered stock goes' },
  LOSS: { icon: PackageX, text: 'Scrap, shrinkage and count corrections' },
} as const;

export function WarehousesPage() {
  const { isManager } = useAuth();
  const routeLocation = useLocation();
  const treeRef = useRef<HTMLDivElement>(null);
  const tree = useLocationTree();
  const virtual = useLocations({ includeVirtual: true });
  const [whDialog, setWhDialog] = useState<{ open: boolean; wh: Warehouse | null }>({
    open: false,
    wh: null,
  });
  const [locDialog, setLocDialog] = useState<LocDialogState>(null);
  const [toDelete, setToDelete] = useState<
    { kind: 'location'; node: LocationNode } | { kind: 'warehouse'; wh: WarehouseTree } | null
  >(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (routeLocation.pathname.endsWith('/locations'))
      treeRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [routeLocation.pathname, tree.isSuccess]);

  const remove = useApiMutation(
    () => {
      if (!toDelete) return Promise.resolve();
      return toDelete.kind === 'location'
        ? api.delete(`/locations/${toDelete.node.id}`)
        : api.delete(`/warehouses/${toDelete.wh.id}`);
    },
    { success: 'Deleted', invalidate: ['locations', 'warehouses'] },
  );

  const allIds = useMemo(() => {
    const ids: number[] = [];
    const walk = (ns: LocationNode[]) => ns.forEach((n) => (ids.push(n.id), walk(n.children)));
    tree.data?.forEach((w) => walk(w.locations));
    return ids;
  }, [tree.data]);

  const toggle = (id: number) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onAction =
    (wh: WarehouseTree) => (a: { kind: 'add' | 'rename' | 'delete'; node: LocationNode }) => {
      if (a.kind === 'add') setLocDialog({ mode: 'create', warehouse: wh, parent: a.node });
      if (a.kind === 'rename') setLocDialog({ mode: 'rename', node: a.node });
      if (a.kind === 'delete') setToDelete({ kind: 'location', node: a.node });
    };

  if (tree.error) return <ErrorState error={tree.error} onRetry={() => void tree.refetch()} />;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Settings' }, { label: 'Warehouses & Locations' }]}
        title="Warehouses & Locations"
        subtitle="Physical warehouses, their rack hierarchy, and the virtual locations that balance the ledger."
        actions={
          isManager && (
            <Button onClick={() => setWhDialog({ open: true, wh: null })}>
              <Plus /> New warehouse
            </Button>
          )
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {tree.isLoading && [1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
        {tree.data?.map((w) => {
          const units = w.locations.reduce((a, n) => a + subtreeUnits(n), 0);
          return (
            <Panel key={w.id} className="border-t-4 border-t-plum p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-plum-tint text-plum">
                  <Building2 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-headline-sm font-semibold">
                    <span className="font-mono">{w.code}</span> · {w.name}
                  </h3>
                  <p className="truncate text-sm text-muted-foreground">
                    {w.address || 'No address'}
                  </p>
                </div>
                {isManager && (
                  <Button
                    variant="link"
                    className="text-sm"
                    onClick={() => setWhDialog({ open: true, wh: w })}
                  >
                    Edit <ChevronRight className="size-3.5" />
                  </Button>
                )}
              </div>
              <div className="mt-4 flex items-end gap-8">
                <p>
                  <span className="font-mono text-[28px] font-semibold">{fmtQty(units)}</span>{' '}
                  <span className="text-sm text-muted-foreground">units on hand</span>
                </p>
                <p className="pb-1 text-sm text-muted-foreground">
                  <b className="text-ink">{countNodes(w.locations)}</b> locations
                </p>
              </div>
              {isManager && w.locations.length === 0 && (
                <Button
                  variant="ghost-danger"
                  size="sm"
                  className="mt-2"
                  onClick={() => setToDelete({ kind: 'warehouse', wh: w })}
                >
                  <Trash2 /> Delete empty warehouse
                </Button>
              )}
            </Panel>
          );
        })}
      </div>

      <div ref={treeRef} className="scroll-mt-24">
        <Panel className="mb-8">
          <SectionHeaderBar
            icon={Network}
            title="Location tree"
            actions={
              <>
                <div className="relative hidden sm:block">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-white/70" />
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value.toLowerCase())}
                    placeholder="Filter locations…"
                    aria-label="Filter locations"
                    className="h-8 w-52 rounded-md border border-white/20 bg-white/10 pr-2 pl-8 text-sm text-white outline-none placeholder:text-white/60 focus:bg-white/20"
                  />
                </div>
                <button
                  onClick={() => setCollapsed((s) => (s.size ? new Set() : new Set(allIds)))}
                  className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20"
                >
                  <ChevronsDownUp className="size-3.5" />{' '}
                  {collapsed.size ? 'Expand all' : 'Collapse all'}
                </button>
              </>
            }
          />
          <div className="space-y-4 p-4 sm:p-6">
            {tree.isLoading && <Skeleton className="h-48" />}
            {tree.data?.length === 0 && (
              <EmptyState
                icon={WarehouseIcon}
                title="No warehouses yet"
                description="Create a warehouse, then add its stock locations."
              />
            )}
            {tree.data?.map((w) => (
              <div key={w.id} className="rounded-lg border border-divider p-3">
                <div className="flex items-center gap-2 px-2 pb-2">
                  <Building2 className="size-4 text-plum" />
                  <span className="font-display font-semibold">{w.code}</span>
                  <span className="text-sm text-muted-foreground">({w.name})</span>
                </div>
                <ul>
                  {w.locations.map((n) => (
                    <TreeRow
                      key={n.id}
                      node={n}
                      depth={0}
                      warehouse={w}
                      collapsed={collapsed}
                      toggle={toggle}
                      filter={filter}
                      onAction={onAction(w)}
                      canEdit={isManager}
                    />
                  ))}
                </ul>
                {isManager && (
                  <button
                    onClick={() => setLocDialog({ mode: 'create', warehouse: w, parent: null })}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-divider py-2.5 text-sm font-medium text-link hover:bg-deck"
                  >
                    <Plus className="size-4" /> Add root location in {w.code}
                  </button>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-headline-md font-semibold">System locations</h2>
          <p className="text-sm text-muted-foreground">
            Virtual endpoints that model the outside world so every move is balanced.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lock className="size-3.5" /> Read-only
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {virtual.data
          ?.filter((l) => l.type !== 'INTERNAL')
          .map((l) => {
            const meta = VIRTUAL_META[l.type as keyof typeof VIRTUAL_META];
            const Icon = meta.icon;
            return (
              <div key={l.id} className="rounded-lg border border-divider bg-deck p-5">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-plum" />
                  <span className="font-semibold">{l.name}</span>
                  <span className="ml-auto rounded-full bg-canvas px-2 py-0.5 text-xs text-muted-foreground">
                    Virtual
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{meta.text}</p>
                <p className="mt-4 flex items-center justify-between border-t border-divider pt-3 font-mono text-xs text-muted-foreground">
                  {l.fullName.toUpperCase()} <Lock className="size-3.5" />
                </p>
              </div>
            );
          })}
      </div>

      <WarehouseDialog
        open={whDialog.open}
        warehouse={whDialog.wh}
        onOpenChange={(o) => setWhDialog((s) => ({ ...s, open: o }))}
      />
      <LocationDialog state={locDialog} onClose={() => setLocDialog(null)} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={
          toDelete?.kind === 'warehouse'
            ? `Delete ${toDelete.wh.code}?`
            : `Delete ${toDelete?.node.fullName ?? ''}?`
        }
        description="Locations that hold stock, have sub-locations, or appear in past operations can't be deleted."
        confirmLabel="Delete"
        tone="danger"
        busy={remove.isPending}
        onConfirm={() => remove.mutate(undefined, { onSettled: () => setToDelete(null) })}
      />
    </>
  );
}
