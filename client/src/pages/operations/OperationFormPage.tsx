import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Info,
  ListChecks,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/common/FormField';
import { Breadcrumbs } from '@/components/common/PageHeader';
import { Panel, SectionHeaderBar } from '@/components/common/SectionHeaderBar';
import { ErrorState } from '@/components/common/States';
import { StatusPill } from '@/components/common/StatusPill';
import { StatusStepper } from '@/components/operations/StatusStepper';
import { useLocations, useProducts } from '@/hooks/useMasterData';
import { useOperation } from '@/hooks/useOperations';
import { useOperationActions } from '@/hooks/useOperationActions';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, fmtQty } from '@/lib/format';
import { OP_META, toLocalInput, type DocType } from '@/lib/operations';
import type { OperationDetail, ProductStock } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useWarehouse } from '@/providers/warehouse';

type LineDraft = { key: string; productId: string; demandQty: string; doneQty: string };
type Draft = {
  partner: string;
  sourceLocId: string;
  destLocId: string;
  scheduledDate: string;
  notes: string;
  lines: LineDraft[];
};

let keySeq = 0;
const newKey = () => `l${++keySeq}`;

function fromOperation(op: OperationDetail): Draft {
  return {
    partner: op.partner ?? '',
    sourceLocId: String(op.sourceLocId),
    destLocId: String(op.destLocId),
    scheduledDate: toLocalInput(op.scheduledDate),
    notes: op.notes ?? '',
    lines: op.lines.map((l) => ({
      key: newKey(),
      productId: String(l.productId),
      demandQty: String(l.demandQty),
      doneQty: l.doneQty ? String(l.doneQty) : '',
    })),
  };
}

function LocationSelect({
  value,
  onChange,
  disabled,
  label,
  locations,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  label: string;
  locations: { id: number; fullName: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className="h-[42px] w-full rounded-lg font-mono text-[13px]"
        aria-label={label}
      >
        <SelectValue placeholder="Choose a location" />
      </SelectTrigger>
      <SelectContent>
        {locations.map((l) => (
          <SelectItem key={l.id} value={String(l.id)} className="font-mono text-[13px]">
            {l.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function OperationFormPage({ type }: { type: DocType }) {
  const meta = OP_META[type];
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { warehouseId } = useWarehouse();
  const { data: op, isLoading, error, refetch } = useOperation(id);
  const { data: locations = [] } = useLocations();
  const { data: productPage } = useProducts({ page: 1, pageSize: 100 });
  const products = useMemo(() => productPage?.items ?? [], [productPage]);
  const actions = useOperationActions();

  const [draftForStock, setDraftForStock] = useState<{ ids: number[]; source: number }>({
    ids: [],
    source: 0,
  });
  // Stock per location for every product on the document, so availability shows while editing.
  const stockQueries = useQueries({
    queries: draftForStock.ids.map((pid) => ({
      queryKey: ['products', pid, 'stock'],
      queryFn: () => api.get<ProductStock>(`/products/${pid}/stock`),
      enabled: meta.pick.source,
    })),
  });
  const stockByProduct = new Map(
    stockQueries.flatMap((q, i) => (q.data ? [[draftForStock.ids[i]!, q.data] as const] : [])),
  );
  const availableFor = (productId: string): number | undefined => {
    const st = stockByProduct.get(Number(productId));
    if (!st) return undefined;
    return st.locations.find((x) => x.location.id === draftForStock.source)?.quantity ?? 0;
  };

  const [draft, setDraft] = useState<Draft | null>(null);
  const [initial, setInitial] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Live refreshes (sockets, refetch) must not wipe edits in progress: only re-sync from the
  // server when nothing is dirty or the document changed status underneath us.
  const dirtyRef = useRef(false);
  const statusRef = useRef<string | null>(null);
  dirtyRef.current = !!draft && JSON.stringify(draft) !== initial;

  // Initialise the editable copy from the server document, or defaults for a new one.
  useEffect(() => {
    if (!id || !op) return;
    if (dirtyRef.current && statusRef.current === op.status) return;
    statusRef.current = op.status;
    const d = fromOperation(op);
    setDraft(d);
    setInitial(JSON.stringify(d));
  }, [id, op]);
  useEffect(() => {
    if (id || draft || locations.length === 0) return;
    const inWh = locations.filter((l) => !warehouseId || l.warehouseId === warehouseId);
    // Default to the warehouse's main "Stock" location; transfers go to one of its sub-locations.
    const first =
      inWh.find((l) => !l.parentId && l.name.toLowerCase() === 'stock') ??
      inWh.find((l) => !l.parentId) ??
      inWh[0] ??
      locations[0];
    const second =
      inWh.find((l) => l.parentId === first?.id) ??
      inWh.find((l) => l.id !== first?.id) ??
      locations.find((l) => l.id !== first?.id);
    const productId = search.get('productId') ?? '';
    const d: Draft = {
      partner: '',
      sourceLocId: meta.pick.source ? String(first?.id ?? '') : '',
      destLocId: meta.pick.dest ? String((type === 'INTERNAL' ? second : first)?.id ?? '') : '',
      scheduledDate: toLocalInput(new Date(Date.now() + 3600_000)),
      notes: '',
      lines: [{ key: newKey(), productId, demandQty: search.get('qty') ?? '', doneQty: '' }],
    };
    setDraft(d);
    setInitial(JSON.stringify(d));
  }, [id, draft, locations, warehouseId, search, meta.pick, type]);

  const stockKey = draft
    ? `${draft.sourceLocId}|${[...new Set(draft.lines.map((l) => l.productId).filter(Boolean))].join(',')}`
    : '';
  useEffect(() => {
    if (!stockKey) return;
    const [source, ids] = stockKey.split('|');
    setDraftForStock({ source: Number(source) || 0, ids: ids ? ids.split(',').map(Number) : [] });
  }, [stockKey]);

  if (id && error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!draft || (id && isLoading)) {
    return (
      <div className="min-w-0 space-y-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-20" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const status = op?.status ?? 'DRAFT';
  const isNew = !id;
  const editable = isNew || status === 'DRAFT';
  const doneEditable = status === 'READY' || status === 'WAITING';
  const dirty = JSON.stringify(draft) !== initial;
  const productById = new Map(products.map((p) => [String(p.id), p]));
  const lineInfo = new Map(op?.lines.map((l) => [String(l.productId), l]) ?? []);
  const update = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setLine = (key: string, patch: Partial<LineDraft>) =>
    update({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });

  function validateDraft(): string | null {
    if (meta.pick.source && !draft!.sourceLocId) return 'Choose a source location';
    if (meta.pick.dest && !draft!.destLocId) return 'Choose a destination location';
    if (type === 'INTERNAL' && draft!.sourceLocId === draft!.destLocId)
      return 'Source and destination must differ';
    const lines = draft!.lines.filter((l) => l.productId);
    if (lines.length === 0) return 'Add at least one product';
    if (new Set(lines.map((l) => l.productId)).size !== lines.length)
      return 'Each product can appear only once';
    if (lines.some((l) => !(Number(l.demandQty) > 0)))
      return 'Every line needs a quantity greater than 0';
    return null;
  }

  const body = () => ({
    partner: meta.partnerLabel ? draft.partner.trim() || null : null,
    sourceLocId: meta.pick.source ? Number(draft.sourceLocId) : undefined,
    destLocId: meta.pick.dest ? Number(draft.destLocId) : undefined,
    scheduledDate: new Date(draft.scheduledDate).toISOString(),
    notes: draft.notes.trim() || null,
    lines: draft.lines
      .filter((l) => l.productId)
      .map((l) => ({ productId: Number(l.productId), demandQty: Number(l.demandQty) })),
  });

  /** Persists pending edits (draft fields, or done quantities on ready documents). */
  async function persist() {
    if (!dirty || !id) return;
    const payload = doneEditable
      ? {
          lines: draft!.lines.map((l) => ({
            productId: Number(l.productId),
            demandQty: Number(l.demandQty),
            doneQty: Number(l.doneQty) || 0,
          })),
        }
      : body();
    const saved = await api.patch<OperationDetail>(`/operations/${id}`, payload);
    qc.setQueryData(['operations', 'detail', id], saved);
  }

  async function save(andConfirm: boolean) {
    const problem = validateDraft();
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      if (isNew) {
        const created = await api.post<OperationDetail>('/operations', { type, ...body() });
        await qc.invalidateQueries({ queryKey: ['operations'] });
        if (andConfirm) await actions.confirm(created);
        else toast.success(`${created.reference} saved as draft`);
        navigate(`${meta.path}/${created.id}`, { replace: true });
      } else if (andConfirm && op) {
        await actions.confirm(op, persist);
      } else {
        await persist();
        await qc.invalidateQueries({ queryKey: ['operations'] });
        toast.success('Changes saved');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function printSlip() {
    try {
      const blob = await api.blob(`/operations/${id}/slip.pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const busy = saving || actions.busy;
  const Icon = meta.icon;
  const virtualSide = type === 'RECEIPT' ? 'Vendors' : type === 'DELIVERY' ? 'Customers' : null;
  const shortLines = doneEditable
    ? (op?.lines ?? []).filter(
        (l) => l.availableQty !== null && l.availableQty < (l.doneQty || l.demandQty),
      )
    : [];
  // Before confirming: warn that a short draft will wait for stock instead of being ready.
  const draftShort = editable
    ? draft.lines.filter((l) => {
        const a = availableFor(l.productId);
        return l.productId && a !== undefined && a < (Number(l.demandQty) || 0);
      })
    : [];

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { label: 'Operations' },
          { label: meta.plural, to: meta.path },
          { label: op?.reference ?? 'New' },
        ]}
      />
      <div className="min-w-0 space-y-6">
        {/* Document header */}
        <Panel className="flex flex-wrap items-center gap-4 p-5">
          <span className="flex size-12 items-center justify-center rounded-lg bg-plum text-primary-foreground">
            <Icon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold text-ink">
                {op?.reference ?? `New ${meta.label.toLowerCase()}`}
              </h1>
              <StatusPill status={status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {meta.label}
              {op?.partner ? ` · ${op.partner}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {op && !['DONE', 'CANCELED'].includes(status) && (
              <Button
                variant="outline"
                className="text-danger"
                disabled={busy}
                onClick={() => actions.requestCancel(op)}
              >
                <XCircle /> Cancel
              </Button>
            )}
            {type === 'DELIVERY' && status === 'DONE' && (
              <Button variant="teal" onClick={() => void printSlip()}>
                <Printer /> Print slip
              </Button>
            )}
            {editable && (
              <Button
                variant="outline"
                disabled={busy || (!isNew && !dirty)}
                onClick={() => void save(false)}
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save />}{' '}
                {isNew ? 'Save draft' : 'Save'}
              </Button>
            )}
            {editable && (
              <Button disabled={busy} onClick={() => void save(true)}>
                <Send /> {isNew ? 'Save & confirm' : 'Confirm'}
              </Button>
            )}
            {status === 'WAITING' && (
              <Button variant="teal" disabled={busy} onClick={() => void refetch()}>
                <RefreshCw /> Check availability
              </Button>
            )}
            {op && doneEditable && (
              <Button disabled={busy} onClick={() => actions.requestValidate(op, persist)}>
                <CheckCircle2 /> Validate
              </Button>
            )}
          </div>
        </Panel>

        <Panel className="px-4 py-5 sm:px-8">
          <StatusStepper status={status} type={type} />
        </Panel>

        {shortLines.length > 0 && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning"
          >
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              Not enough stock at <b>{op?.sourceLoc.fullName}</b> for{' '}
              {shortLines
                .map(
                  (l) =>
                    `${l.product.name} (${fmtQty(l.availableQty ?? 0)} of ${fmtQty(l.doneQty || l.demandQty)} ${l.product.uom})`,
                )
                .join(', ')}
              . It will move to Ready automatically once stock arrives.
            </p>
          </div>
        )}

        {draftShort.length > 0 && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-warning"
          >
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              The source doesn’t hold enough of{' '}
              {draftShort.map((l) => productById.get(l.productId)?.name ?? 'a product').join(', ')}.
              If you confirm now, this document will wait for stock.
            </p>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            <Panel>
              <SectionHeaderBar icon={FileText} title={`${meta.label} details`} />
              <div className="grid gap-5 p-6 sm:grid-cols-2">
                {meta.partnerLabel && (
                  <FormField label={meta.partnerLabel} htmlFor="partner">
                    <Input
                      id="partner"
                      value={draft.partner}
                      disabled={!editable}
                      placeholder={`${meta.partnerLabel} name`}
                      onChange={(e) => update({ partner: e.target.value })}
                    />
                  </FormField>
                )}
                <FormField label="Scheduled date" htmlFor="scheduled">
                  <Input
                    id="scheduled"
                    type="datetime-local"
                    value={draft.scheduledDate}
                    disabled={!editable}
                    onChange={(e) => update({ scheduledDate: e.target.value })}
                  />
                </FormField>
                <FormField label="Source location">
                  {meta.pick.source ? (
                    <LocationSelect
                      label="Source location"
                      value={draft.sourceLocId}
                      onChange={(v) => update({ sourceLocId: v })}
                      disabled={!editable}
                      locations={locations}
                    />
                  ) : (
                    <p className="flex h-[42px] items-center rounded-lg border border-dashed border-divider px-3 text-sm text-muted-foreground italic">
                      {virtualSide} (virtual)
                    </p>
                  )}
                </FormField>
                <FormField label="Destination location">
                  {meta.pick.dest ? (
                    <LocationSelect
                      label="Destination location"
                      value={draft.destLocId}
                      onChange={(v) => update({ destLocId: v })}
                      disabled={!editable}
                      locations={locations}
                    />
                  ) : (
                    <p className="flex h-[42px] items-center rounded-lg border border-dashed border-divider px-3 text-sm text-muted-foreground italic">
                      {virtualSide} (virtual)
                    </p>
                  )}
                </FormField>
                <FormField label="Notes" htmlFor="notes" className="sm:col-span-2">
                  <Textarea
                    id="notes"
                    rows={2}
                    value={draft.notes}
                    disabled={!editable}
                    onChange={(e) => update({ notes: e.target.value })}
                    placeholder="Instructions, carrier, PO number…"
                  />
                </FormField>
              </div>
            </Panel>

            <Panel>
              <SectionHeaderBar
                icon={ListChecks}
                title="Products"
                badge={`${draft.lines.filter((l) => l.productId).length} items`}
              />
              <div className="overflow-x-auto">
                <table className="stack-table w-full text-sm">
                  <thead>
                    <tr className="h-[38px] border-b border-divider bg-deck text-left text-label font-semibold tracking-wide text-muted-foreground uppercase">
                      <th className="px-4">Product</th>
                      <th className="px-4 text-right">Demand</th>
                      {!editable && (
                        <th className="px-4 text-right">
                          {status === 'DONE' ? 'Done' : 'Done qty'}
                        </th>
                      )}
                      {meta.pick.source && <th className="px-4 text-right">Available</th>}
                      {editable && <th className="w-12 px-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.lines.map((l) => {
                      const p = productById.get(l.productId);
                      const info = lineInfo.get(l.productId);
                      const need = Number(l.doneQty) || Number(l.demandQty) || 0;
                      const avail =
                        meta.pick.source && !['DONE', 'CANCELED'].includes(status)
                          ? availableFor(l.productId)
                          : undefined;
                      const short = avail !== undefined && need > 0 && avail < need;
                      return (
                        <tr key={l.key} className="border-b border-divider last:border-0">
                          <td data-label="Product" className="stack-block px-4 py-2.5">
                            {editable ? (
                              <Select
                                value={l.productId}
                                onValueChange={(v) => setLine(l.key, { productId: v })}
                              >
                                <SelectTrigger
                                  className="h-10 w-full min-w-40 rounded-lg"
                                  aria-label="Product"
                                >
                                  <SelectValue placeholder="Choose a product" />
                                </SelectTrigger>
                                <SelectContent>
                                  {products.map((pr) => (
                                    <SelectItem
                                      key={pr.id}
                                      value={String(pr.id)}
                                      disabled={draft.lines.some(
                                        (x) => x.key !== l.key && x.productId === String(pr.id),
                                      )}
                                    >
                                      {pr.name}{' '}
                                      <span className="font-mono text-xs text-muted-foreground">
                                        {pr.sku}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div>
                                <p className="font-medium text-ink">
                                  {info?.product.name ?? p?.name}
                                </p>
                                <p className="font-mono text-xs text-muted-foreground">
                                  {info?.product.sku ?? p?.sku}
                                </p>
                              </div>
                            )}
                          </td>
                          <td data-label="Demand" className="px-4 py-2.5 text-right">
                            {editable ? (
                              <div className="flex items-center justify-end gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={l.demandQty}
                                  onChange={(e) => setLine(l.key, { demandQty: e.target.value })}
                                  className="h-10 w-20 text-right font-mono sm:w-28"
                                  aria-label="Demand quantity"
                                />
                                <span className="w-10 text-left text-muted-foreground">
                                  {p?.uom}
                                </span>
                              </div>
                            ) : (
                              <span className="font-mono">
                                {fmtQty(Number(l.demandQty))} {info?.product.uom}
                              </span>
                            )}
                          </td>
                          {!editable && (
                            <td
                              data-label={status === 'DONE' ? 'Done' : 'Done qty'}
                              className="px-4 py-2.5 text-right"
                            >
                              {doneEditable ? (
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={l.doneQty}
                                  placeholder={l.demandQty}
                                  onChange={(e) => setLine(l.key, { doneQty: e.target.value })}
                                  className="ml-auto h-10 w-20 border-plum sm:w-28 text-right font-mono"
                                  aria-label="Done quantity"
                                />
                              ) : (
                                <span className="font-mono">
                                  {status === 'DONE'
                                    ? `${fmtQty(Number(l.doneQty) || Number(l.demandQty))} ${info?.product.uom ?? ''}`
                                    : '—'}
                                </span>
                              )}
                            </td>
                          )}
                          {meta.pick.source && (
                            <td
                              data-label="Available"
                              className={cn(
                                'px-4 py-2.5 text-right font-mono whitespace-nowrap',
                                short ? 'font-semibold text-danger' : 'text-muted-foreground',
                              )}
                            >
                              {avail !== undefined
                                ? `${fmtQty(avail)} ${p?.uom ?? info?.product.uom ?? ''}`
                                : '—'}
                            </td>
                          )}
                          {editable && (
                            <td className="px-2">
                              <Button
                                variant="ghost-danger"
                                size="icon-sm"
                                aria-label="Remove line"
                                disabled={draft.lines.length === 1}
                                onClick={() =>
                                  update({ lines: draft.lines.filter((x) => x.key !== l.key) })
                                }
                              >
                                <Trash2 />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {editable && (
                <div className="border-t border-divider bg-deck p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      update({
                        lines: [
                          ...draft.lines,
                          { key: newKey(), productId: '', demandQty: '', doneQty: '' },
                        ],
                      })
                    }
                  >
                    <Plus /> Add product
                  </Button>
                </div>
              )}
              {doneEditable && (
                <p className="border-t border-divider bg-deck px-4 py-2.5 text-xs text-muted-foreground">
                  Leave “Done qty” empty to validate the full demand. Enter less to record a partial{' '}
                  {meta.label.toLowerCase()}.
                </p>
              )}
            </Panel>
          </div>

          <div className="min-w-0 space-y-6">
            <Panel className="p-5">
              <h3 className="mb-3 font-display text-headline-sm font-semibold">Summary</h3>
              <dl className="space-y-2.5 text-sm">
                {[
                  ['Responsible', op?.createdBy.name ?? 'You'],
                  ['Created', op ? fmtDateTime(op.createdAt) : '—'],
                  ['Scheduled', op ? fmtDateTime(op.scheduledDate) : '—'],
                  ['Validated', op?.validatedAt ? fmtDateTime(op.validatedAt) : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel className="p-5">
              <h3 className="mb-1 font-display text-headline-sm font-semibold">Ledger effect</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                {status === 'DONE'
                  ? 'Moves written when validated:'
                  : 'Moves that validation will write:'}
              </p>
              <ul className="space-y-2">
                {draft.lines
                  .filter((l) => l.productId)
                  .map((l) => {
                    const p = productById.get(l.productId) ?? lineInfo.get(l.productId)?.product;
                    const src = meta.pick.source
                      ? locations.find((x) => String(x.id) === draft.sourceLocId)?.fullName
                      : 'Vendors';
                    const dst = meta.pick.dest
                      ? locations.find((x) => String(x.id) === draft.destLocId)?.fullName
                      : 'Customers';
                    return (
                      <li key={l.key} className="rounded-lg bg-deck p-2.5 text-xs">
                        <p className="font-medium text-ink">
                          {fmtQty(Number(l.doneQty) || Number(l.demandQty) || 0)} {p?.uom} ·{' '}
                          {p?.name}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-1 font-mono text-muted-foreground">
                          {src ?? '?'} <ArrowRight className="size-3" /> {dst ?? '?'}
                        </p>
                      </li>
                    );
                  })}
              </ul>
            </Panel>
            {!isNew && (
              <Link
                to={`${meta.path}`}
                className="block text-center text-sm font-medium text-link hover:underline"
              >
                ← Back to all {meta.plural.toLowerCase()}
              </Link>
            )}
          </div>
        </div>
      </div>
      {actions.dialog}
    </>
  );
}
