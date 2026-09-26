import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  Download,
  Info,
  Loader2,
  Package,
  ShieldCheck,
  Sparkles,
  Warehouse,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FormField } from '@/components/common/FormField';
import { LogoMark, Wordmark } from '@/components/common/Logo';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel, SectionHeaderBar } from '@/components/common/SectionHeaderBar';
import { ErrorState } from '@/components/common/States';
import { useCategories, useLocations, useProduct } from '@/hooks/useMasterData';
import { api, ApiError, errorMessage } from '@/lib/api';
import { fmtQty } from '@/lib/format';
import { downloadDataUrl, renderLabelPng, skuQrDataUrl } from '@/lib/label';
import type { Product } from '@/lib/types';
import { useQueryClient } from '@tanstack/react-query';

const UOMS = [
  'pcs',
  'kg',
  'g',
  'm',
  'cm',
  'L',
  'ml',
  'box',
  'pack',
  'roll',
  'ream',
  'pair',
  'sheet',
];
const qty = z.coerce
  .number({ error: 'Enter a number' })
  .min(0, 'Cannot be negative')
  .refine((n) => Math.abs(Math.round(n * 1000) - n * 1000) < 1e-6, 'At most 3 decimals');

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9._-]{1,39}$/, '2–40 letters, digits, ".", "_" or "-"'),
    categoryId: z.string().min(1, 'Choose a category'),
    uom: z.string().trim().min(1, 'Unit is required').max(20),
    reorderMin: qty,
    reorderQty: qty,
    initialQty: qty,
    initialLocationId: z.string(),
  })
  .refine((v) => !(v.initialQty > 0) || v.initialLocationId, {
    message: 'Choose where the opening stock is',
    path: ['initialLocationId'],
  });
type In = z.input<typeof schema>;
type Out = z.output<typeof schema>;

function autoSku(name: string, category: string | undefined) {
  const part = (s: string, n: number) =>
    s
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, n)
      .toUpperCase();
  const prefix = part(category ?? 'GEN', 2) || 'GN';
  const stem = part(name, 3) || 'ITM';
  return `${prefix}-${stem}-${String(Math.floor(Math.random() * 900) + 100)}`;
}

function LabelPreview({
  sku,
  name,
  uom,
  category,
}: {
  sku: string;
  name: string;
  uom: string;
  category?: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const valid = /^[A-Z0-9][A-Z0-9._-]{1,39}$/i.test(sku);
  useEffect(() => {
    if (!valid) return;
    let alive = true;
    const t = setTimeout(
      () => void skuQrDataUrl(sku.toUpperCase(), 200).then((d) => alive && setQr(d)),
      200,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [sku, valid]);

  return (
    <Panel className="p-6">
      <div className="mb-4 flex items-baseline justify-between border-b border-divider pb-3">
        <h3 className="font-display text-headline-sm font-semibold">Label preview</h3>
        <span className="text-xs font-semibold text-muted-foreground">100 × 60 MM</span>
      </div>
      <div className="rounded-lg border border-dashed border-divider bg-deck p-4 text-center">
        <p className="mb-3 flex items-center gap-1.5">
          <LogoMark className="size-5" />
          <Wordmark className="text-sm" />
        </p>
        <div className="mx-auto mb-3 flex size-32 items-center justify-center rounded-lg border border-divider bg-white p-2">
          {valid && qr ? (
            <img src={qr} alt={`QR code for ${sku}`} className="size-full" />
          ) : (
            <Package className="size-8 text-muted-foreground" />
          )}
        </div>
        <p className="font-mono text-sm font-semibold tracking-wider">
          {valid ? sku.toUpperCase() : 'SKU'}
        </p>
        <p className="mt-1 text-sm font-semibold text-ink">{name || 'Product name'}</p>
        <p className="text-xs text-muted-foreground">
          {[uom, category].filter(Boolean).join(' · ') || '—'}
        </p>
      </div>
      <Button
        type="button"
        className="mt-4 w-full"
        disabled={!valid || !name}
        onClick={async () =>
          downloadDataUrl(
            await renderLabelPng({ sku: sku.toUpperCase(), name, uom, category }),
            `label-${sku.toUpperCase()}.png`,
          )
        }
      >
        <Download /> Download label (PNG)
      </Button>
    </Panel>
  );
}

export function ProductFormPage() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const { data: locations = [] } = useLocations();
  const existing = useProduct(editId ?? 0, editId !== null);
  const editing = editId !== null;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      sku: '',
      categoryId: '',
      uom: 'pcs',
      reorderMin: 0,
      reorderQty: 0,
      initialQty: 0,
      initialLocationId: '',
    },
  });

  useEffect(() => {
    const p = existing.data;
    if (editing && p) {
      reset({
        name: p.name,
        sku: p.sku,
        categoryId: String(p.categoryId),
        uom: p.uom,
        reorderMin: p.reorderMin,
        reorderQty: p.reorderQty,
        initialQty: 0,
        initialLocationId: '',
      });
    }
  }, [editing, existing.data, reset]);

  const [name, sku, uom, categoryId, reorderMin, reorderQty] = useWatch({
    control,
    name: ['name', 'sku', 'uom', 'categoryId', 'reorderMin', 'reorderQty'],
  });
  const categoryName = categories.find((c) => String(c.id) === categoryId)?.name;

  const onSubmit = async (v: Out) => {
    const body = {
      name: v.name,
      sku: v.sku,
      uom: v.uom,
      categoryId: Number(v.categoryId),
      reorderMin: v.reorderMin,
      reorderQty: v.reorderQty,
    };
    try {
      const saved = editing
        ? await api.patch<Product>(`/products/${editId}`, body)
        : await api.post<Product>('/products', {
            ...body,
            ...(v.initialQty > 0 && {
              initialQty: v.initialQty,
              initialLocationId: Number(v.initialLocationId),
            }),
          });
      await qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(editing ? 'Product updated' : 'Product created');
      navigate(`/products/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        setError('sku', { message: 'This SKU is already used' });
      toast.error(errorMessage(err));
    }
  };

  if (editing && existing.error)
    return <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />;
  if (editing && existing.isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <PageHeader
        crumbs={[
          { label: 'Inventory' },
          { label: 'Products', to: '/products' },
          { label: editing ? 'Edit' : 'New' },
        ]}
        title={editing ? `Edit ${existing.data?.name ?? 'product'}` : 'New product'}
        subtitle="Define catalogue details, stocking thresholds and opening stock."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={editing ? `/products/${editId}` : '/products'}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {editing ? 'Save changes' : 'Create product'}
            </Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Panel>
            <SectionHeaderBar
              icon={Package}
              title="Product details"
              actions={
                <span className="text-xs font-semibold tracking-wide">MASTER REFERENCE</span>
              }
            />
            <div className="grid gap-5 p-6 sm:grid-cols-2">
              <FormField
                label="Product name"
                htmlFor="name"
                required
                error={errors.name?.message}
                className="sm:col-span-2"
              >
                <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
              </FormField>
              <FormField
                label="SKU / Internal reference"
                htmlFor="sku"
                required
                error={errors.sku?.message}
                labelAside={
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-medium text-link hover:underline"
                    onClick={() =>
                      setValue('sku', autoSku(name, categoryName), { shouldValidate: true })
                    }
                  >
                    <Sparkles className="size-3.5" /> Auto-generate
                  </button>
                }
              >
                <Input
                  id="sku"
                  className="font-mono uppercase"
                  aria-invalid={!!errors.sku}
                  {...register('sku')}
                />
              </FormField>
              <FormField label="Category" required error={errors.categoryId?.message}>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className="h-[42px] w-full rounded-lg"
                        aria-invalid={!!errors.categoryId}
                        aria-label="Category"
                      >
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField
                label="Unit of measure (UoM)"
                htmlFor="uom"
                required
                error={errors.uom?.message}
                hint="Pick one or type your own"
              >
                <Input
                  id="uom"
                  list="uom-options"
                  aria-invalid={!!errors.uom}
                  {...register('uom')}
                />
                <datalist id="uom-options">
                  {UOMS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </FormField>
            </div>
          </Panel>

          {!editing && (
            <Panel>
              <SectionHeaderBar
                icon={Warehouse}
                title="Initial stock (optional)"
                actions={<span className="text-xs font-semibold tracking-wide">LEDGER INIT</span>}
              />
              <div className="grid gap-5 p-6 sm:grid-cols-2">
                <FormField
                  label="Opening quantity"
                  htmlFor="initialQty"
                  error={errors.initialQty?.message}
                >
                  <div className="relative">
                    <Input
                      id="initialQty"
                      type="number"
                      step="any"
                      min={0}
                      className="pr-14 font-mono"
                      {...register('initialQty')}
                    />
                    <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                      {uom}
                    </span>
                  </div>
                </FormField>
                <FormField label="Initial location" error={errors.initialLocationId?.message}>
                  <Controller
                    control={control}
                    name="initialLocationId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          className="h-[42px] w-full rounded-lg"
                          aria-label="Initial location"
                          aria-invalid={!!errors.initialLocationId}
                        >
                          <SelectValue placeholder="Choose a location" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((l) => (
                            <SelectItem key={l.id} value={String(l.id)}>
                              {l.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <p className="flex items-start gap-2 text-sm text-muted-foreground sm:col-span-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Logged in the ledger as an opening adjustment:{' '}
                    <span className="font-mono text-xs">Virtual/Inventory Loss → location</span>.
                  </span>
                </p>
              </div>
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Panel>
            <SectionHeaderBar icon={ArrowLeftRight} title="Reordering rule" />
            <div className="space-y-5 p-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Minimum qty"
                  htmlFor="reorderMin"
                  error={errors.reorderMin?.message}
                  hint="Trigger threshold"
                >
                  <Input
                    id="reorderMin"
                    type="number"
                    step="any"
                    min={0}
                    className="font-mono"
                    {...register('reorderMin')}
                  />
                </FormField>
                <FormField
                  label="Reorder qty"
                  htmlFor="reorderQty"
                  error={errors.reorderQty?.message}
                  hint="Order batch size"
                >
                  <Input
                    id="reorderQty"
                    type="number"
                    step="any"
                    min={0}
                    className="font-mono"
                    {...register('reorderQty')}
                  />
                </FormField>
              </div>
              <div className="flex gap-3 rounded-lg border border-info-fg/15 bg-info-bg p-4 text-sm text-info-fg">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>
                  When stock falls to{' '}
                  <b>
                    {fmtQty(Number(reorderMin) || 0)} {uom}
                  </b>
                  , the dashboard flags it and offers a draft receipt for{' '}
                  <b>
                    {fmtQty(Number(reorderQty) || 0)} {uom}
                  </b>
                  .
                </p>
              </div>
            </div>
          </Panel>
          <LabelPreview sku={sku} name={name} uom={uom} category={categoryName} />
        </div>
      </div>
    </form>
  );
}
