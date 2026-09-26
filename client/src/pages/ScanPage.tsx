import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { AnimatePresence, motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  CameraOff,
  CheckCircle2,
  ClipboardCheck,
  Keyboard,
  Loader2,
  ScanLine,
  Truck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FilterSelect } from '@/components/common/FilterSelect';
import { FormField } from '@/components/common/FormField';
import { useLocations } from '@/hooks/useMasterData';
import { useLiveStatus, useLiveUpdates } from '@/hooks/useLiveUpdates';
import { api, ApiError, errorMessage } from '@/lib/api';
import { fmtQty } from '@/lib/format';
import type { OperationDetail, ProductStock } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useWarehouse } from '@/providers/warehouse';

type Action = 'RECEIPT' | 'DELIVERY' | 'INTERNAL' | 'COUNT';
const READER_ID = 'qr-reader';

/**
 * Receive / deliver / move in one step: create the document, confirm it and validate it.
 * If validation fails (e.g. not enough stock) the half-made document is canceled so no clutter
 * is left behind, and the original error is shown.
 */
async function quickOperation(body: Record<string, unknown>) {
  const op = await api.post<OperationDetail>('/operations', body);
  await api.post(`/operations/${op.id}/confirm`);
  try {
    return await api.post<OperationDetail>(`/operations/${op.id}/validate`);
  } catch (err) {
    await api.post(`/operations/${op.id}/cancel`).catch(() => undefined);
    throw err;
  }
}

function ActionDialog({
  action,
  stock,
  locationId,
  onClose,
  onDone,
}: {
  action: Action | null;
  stock: ProductStock;
  locationId: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: locations = [] } = useLocations();
  const [qty, setQty] = useState('');
  const [loc, setLoc] = useState<string | undefined>();
  const [dest, setDest] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const p = stock.product;

  useEffect(() => {
    if (!action) return;
    setLoc(locationId ? String(locationId) : locations[0] ? String(locations[0].id) : undefined);
    setDest(undefined);
    const here = stock.locations.find((l) => l.location.id === locationId)?.quantity ?? 0;
    setQty(action === 'COUNT' ? String(here) : '');
  }, [action, locationId, locations, stock.locations]);

  const here = stock.locations.find((l) => String(l.location.id) === loc)?.quantity ?? 0;
  const n = Number(qty);
  const validQty = qty !== '' && Number.isFinite(n) && (action === 'COUNT' ? n >= 0 : n > 0);
  const titles: Record<Action, string> = {
    RECEIPT: 'Receive',
    DELIVERY: 'Deliver',
    INTERNAL: 'Move',
    COUNT: 'Count',
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!action || !loc || !validQty) return;
    setBusy(true);
    try {
      if (action === 'COUNT') {
        const r = await api.post<{ difference: number; operation: { reference: string } | null }>(
          '/adjustments',
          {
            productId: p.id,
            locationId: Number(loc),
            countedQty: n,
            reason: 'Scan Mode count',
          },
        );
        toast.success(
          r.operation
            ? `${r.operation.reference}: ${r.difference > 0 ? '+' : ''}${fmtQty(r.difference)} ${p.uom}`
            : 'Count matches. No change.',
        );
      } else {
        if (action === 'INTERNAL' && (!dest || dest === loc)) {
          setBusy(false);
          return toast.error('Choose a different destination');
        }
        const op = await quickOperation({
          type: action,
          sourceLocId: action === 'RECEIPT' ? undefined : Number(loc),
          destLocId:
            action === 'RECEIPT' ? Number(loc) : action === 'INTERNAL' ? Number(dest) : undefined,
          notes: 'Created in Scan Mode',
          lines: [{ productId: p.id, demandQty: n }],
        });
        toast.success(`${op.reference} done: ${fmtQty(n)} ${p.uom}`);
      }
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : errorMessage(err), { duration: 8000 });
    } finally {
      setBusy(false);
    }
  }

  const locOptions = locations.map((l) => ({ value: String(l.id), label: l.fullName }));
  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="top-auto bottom-0 translate-y-0 rounded-b-none sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:rounded-lg">
        {action && (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="font-display">
                {titles[action]} · {p.name}
              </DialogTitle>
              <DialogDescription>
                {action === 'COUNT'
                  ? 'Enter what is physically on the shelf. The difference is booked immediately.'
                  : 'This is validated immediately and written to the ledger.'}
              </DialogDescription>
            </DialogHeader>
            <FormField
              label={
                action === 'RECEIPT'
                  ? 'Receive into'
                  : action === 'COUNT'
                    ? 'Location counted'
                    : 'From'
              }
            >
              <FilterSelect
                ariaLabel="Location"
                className="h-[42px] w-full font-mono text-[13px]"
                value={loc}
                onChange={setLoc}
                options={locOptions}
              />
            </FormField>
            {action === 'INTERNAL' && (
              <FormField label="To">
                <FilterSelect
                  ariaLabel="Destination"
                  className="h-[42px] w-full font-mono text-[13px]"
                  value={dest}
                  onChange={setDest}
                  options={locOptions.filter((o) => o.value !== loc)}
                />
              </FormField>
            )}
            <FormField
              label={action === 'COUNT' ? 'Counted quantity' : 'Quantity'}
              htmlFor="scan-qty"
              hint={action === 'RECEIPT' ? undefined : `${fmtQty(here)} ${p.uom} on hand here`}
            >
              <div className="flex items-center gap-2">
                <Input
                  id="scan-qty"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  autoFocus
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="h-12 font-mono text-lg"
                />
                <span className="text-muted-foreground">{p.uom}</span>
              </div>
            </FormField>
            <DialogFooter className="flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={busy || !validQty || !loc}>
                {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {titles[action]}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ScanPage() {
  useLiveUpdates(true);
  const live = useLiveStatus();
  const qc = useQueryClient();
  const { current } = useWarehouse();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScan = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [stock, setStock] = useState<ProductStock | null>(null);
  const [selectedLoc, setSelectedLoc] = useState<number | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [manual, setManual] = useState(false);
  const [manualSku, setManualSku] = useState('');

  const lookup = useCallback(async (raw: string) => {
    const sku = raw.trim();
    if (!sku) return;
    setLookingUp(true);
    try {
      const product = await api.get<{ id: number }>(`/products/sku/${encodeURIComponent(sku)}`);
      const s = await api.get<ProductStock>(`/products/${product.id}/stock`);
      setStock(s);
      setSelectedLoc(s.locations[0]?.location.id ?? null);
      try {
        if (scannerRef.current?.isScanning) scannerRef.current.pause(true);
      } catch {
        /* camera not running (manual entry) */
      }
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 404
          ? `No product with SKU “${sku}”`
          : errorMessage(err),
      );
    } finally {
      setLookingUp(false);
    }
  }, []);

  // Start the camera once; stop it when leaving the page.
  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode(READER_ID, {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    scannerRef.current = scanner;
    const onScan = (text: string) => {
      const now = Date.now();
      if (text === lastScan.current.text && now - lastScan.current.at < 3000) return;
      lastScan.current = { text, at: now };
      void lookup(text);
    };
    if (!window.isSecureContext) {
      setCameraError(
        'The camera needs a secure (HTTPS) connection. Use manual entry, or run `npm run dev:https`.',
      );
      return;
    }
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        onScan,
        () => undefined,
      )
      .catch((err: unknown) => {
        if (!cancelled)
          setCameraError(
            String(err).includes('Permission')
              ? 'Camera permission was denied. Allow it in your browser settings, or type the SKU.'
              : 'No camera available. Type the SKU instead.',
          );
      });
    return () => {
      cancelled = true;
      if (scanner.isScanning)
        void scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
      scannerRef.current = null;
    };
  }, [lookup]);

  const scanNext = () => {
    setStock(null);
    setAction(null);
    lastScan.current = { text: '', at: 0 };
    try {
      if (scannerRef.current?.isScanning) scannerRef.current.resume();
    } catch {
      /* scanner not running */
    }
  };

  const refreshProduct = async () => {
    if (!stock) return;
    const s = await api.get<ProductStock>(`/products/${stock.product.id}/stock`);
    setStock(s);
    await Promise.all(
      ['products', 'moves', 'dashboard', 'operations', 'locations'].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
  };

  const ACTIONS: { key: Action; label: string; icon: typeof Truck; cls: string }[] = [
    {
      key: 'RECEIPT',
      label: 'Receive',
      icon: ArrowDownToLine,
      cls: 'bg-chart-in text-white hover:opacity-90',
    },
    { key: 'DELIVERY', label: 'Deliver', icon: Truck, cls: 'bg-teal text-white hover:opacity-90' },
    {
      key: 'INTERNAL',
      label: 'Move',
      icon: ArrowLeftRight,
      cls: 'border-2 border-warning bg-canvas text-warning hover:bg-warning/10',
    },
    {
      key: 'COUNT',
      label: 'Count',
      icon: ClipboardCheck,
      cls: 'border border-divider bg-canvas text-ink hover:bg-deck',
    },
  ];

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      <header className="flex h-14 shrink-0 items-center gap-3 bg-plum-gradient px-4">
        <Link
          to="/dashboard"
          aria-label="Back to dashboard"
          className="flex size-9 items-center justify-center rounded-lg hover:bg-white/10"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold">
          Scan <span className="font-mono text-xs opacity-70">· {current?.code ?? 'All'}</span>
        </h1>
        <span
          className={cn(
            'ml-auto flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px]',
            live ? 'border-mint/50 text-mint' : 'border-white/30 text-white/60',
          )}
        >
          <span className={cn('size-1.5 rounded-full', live ? 'bg-mint' : 'bg-white/50')} />{' '}
          {live ? 'LIVE' : 'OFFLINE'}
        </span>
        <button
          onClick={() => setManual((m) => !m)}
          aria-label="Type a SKU"
          className="flex size-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
        >
          <Keyboard className="size-4" />
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <div
          id={READER_ID}
          className="size-full [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover"
        />
        {!cameraError && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="relative size-60">
              {[
                'top-0 left-0 border-t-4 border-l-4',
                'top-0 right-0 border-t-4 border-r-4',
                'bottom-0 left-0 border-b-4 border-l-4',
                'bottom-0 right-0 border-r-4 border-b-4',
              ].map((c) => (
                <span key={c} className={cn('absolute size-8 rounded-sm border-mint', c)} />
              ))}
              <motion.span
                className="absolute inset-x-3 h-0.5 bg-mint/80 shadow-[0_0_12px] shadow-mint"
                animate={{ top: ['10%', '90%', '10%'] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-sm">
              {lookingUp ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ScanLine className="size-4 text-mint" />
              )}{' '}
              {lookingUp ? 'Looking up…' : 'Point at a product QR label'}
            </span>
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <CameraOff className="size-10 text-white/60" />
            <p className="max-w-xs text-sm text-white/80">{cameraError}</p>
            <Button
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
              onClick={() => setManual(true)}
            >
              <Keyboard /> Enter SKU
            </Button>
          </div>
        )}
        {manual && !stock && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void lookup(manualSku);
            }}
            className="absolute inset-x-4 top-4 flex gap-2 rounded-lg bg-canvas p-2 text-ink shadow-overlay"
          >
            <Input
              autoFocus
              value={manualSku}
              onChange={(e) => setManualSku(e.target.value)}
              placeholder="Type or paste a SKU, e.g. RM-STL-001"
              className="font-mono"
              aria-label="SKU"
            />
            <Button type="submit" disabled={!manualSku.trim() || lookingUp}>
              Find
            </Button>
          </form>
        )}
      </div>

      <AnimatePresence>
        {stock && (
          <motion.section
            key={stock.product.id}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute inset-x-0 bottom-0 max-h-[75svh] overflow-y-auto rounded-t-2xl bg-canvas p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink"
            aria-label="Scanned product"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-divider" />
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 font-display text-headline-md font-semibold">
                  {stock.product.name}
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 font-sans text-xs font-medium text-success">
                    <CheckCircle2 className="size-3" /> Matched
                  </span>
                </h2>
                <p className="font-mono text-xs text-muted-foreground">SKU: {stock.product.sku}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={scanNext}
                aria-label="Close and scan next"
              >
                <X />
              </Button>
            </div>

            <div className="mt-4 flex items-end justify-between rounded-lg border border-divider bg-deck p-4">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Total on hand
              </span>
              <span className="font-mono text-4xl font-semibold text-chart-in">
                {fmtQty(stock.total)} <span className="text-base">{stock.product.uom}</span>
              </span>
            </div>

            <ul className="mt-3 space-y-2" aria-label="Stock by location">
              {stock.locations.length === 0 && (
                <li className="rounded-lg border border-divider p-3 text-sm text-muted-foreground">
                  No stock anywhere yet. Use Receive.
                </li>
              )}
              {stock.locations.map((l) => (
                <li key={l.location.id}>
                  <button
                    onClick={() => setSelectedLoc(l.location.id)}
                    aria-pressed={selectedLoc === l.location.id}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg border p-3 text-left text-sm',
                      selectedLoc === l.location.id ? 'border-plum bg-plum-tint' : 'border-divider',
                    )}
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        selectedLoc === l.location.id ? 'bg-plum' : 'bg-draft',
                      )}
                    />
                    <span className="flex-1 font-medium">{l.location.fullName}</span>
                    {selectedLoc === l.location.id && (
                      <span className="rounded bg-canvas px-1.5 text-[11px] text-muted-foreground">
                        Current
                      </span>
                    )}
                    <span className="font-mono">
                      {fmtQty(l.quantity)} {stock.product.uom}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {ACTIONS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAction(a.key)}
                  className={cn(
                    'flex h-14 items-center justify-center gap-2 rounded-lg font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-plum/25',
                    a.cls,
                  )}
                >
                  <a.icon className="size-5" /> {a.label}
                </button>
              ))}
            </div>
            <Button variant="link" className="mt-3 w-full" onClick={scanNext}>
              <ScanLine /> Scan next item
            </Button>
          </motion.section>
        )}
      </AnimatePresence>

      {stock && (
        <ActionDialog
          action={action}
          stock={stock}
          locationId={selectedLoc}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            void refreshProduct();
          }}
        />
      )}
    </div>
  );
}
