import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { api, errorMessage } from '@/lib/api';
import type { OperationDetail, OpStatus } from '@/lib/types';

type OpRef = { id: number; reference: string; status: OpStatus };
type Pending = {
  kind: 'validate' | 'cancel';
  op: OpRef;
  before?: () => Promise<unknown>;
  /** Some lines are validated below their demand: offer to book the rest as a backorder. */
  partial?: boolean;
} | null;

/**
 * Confirm / Validate / Cancel with the app's rules: Validate and Cancel always ask first,
 * API errors (e.g. INSUFFICIENT_STOCK) are shown verbatim, and every affected view refreshes.
 */
export function useOperationActions() {
  const qc = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [backorder, setBackorder] = useState(true);

  const refresh = () =>
    Promise.all(
      ['operations', 'products', 'moves', 'dashboard', 'locations'].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );

  async function run(fn: () => Promise<OperationDetail>, success: (op: OperationDetail) => string) {
    setBusy(true);
    try {
      const op = await fn();
      qc.setQueryData(['operations', 'detail', op.id], op);
      toast.success(success(op));
      await refresh();
      return op;
    } catch (err) {
      toast.error(errorMessage(err), { duration: 8000 });
      await refresh();
      return null;
    } finally {
      setBusy(false);
    }
  }

  const confirm = (op: OpRef, before?: () => Promise<unknown>) =>
    run(
      async () => {
        await before?.();
        return api.post<OperationDetail>(`/operations/${op.id}/confirm`);
      },
      (o) =>
        o.status === 'WAITING' ? `${o.reference} is waiting for stock` : `${o.reference} is ready`,
    );

  const dialog = (
    <ConfirmDialog
      open={!!pending}
      onOpenChange={(o) => !o && !busy && setPending(null)}
      title={
        pending?.kind === 'validate'
          ? `Validate ${pending.op.reference}?`
          : `Cancel ${pending?.op.reference ?? ''}?`
      }
      description={
        pending?.kind === 'validate' ? (
          <>
            <p>
              Stock will move immediately and the change is written to the ledger. This cannot be
              undone. Correct mistakes later with an adjustment.
            </p>
            {pending.partial && (
              <label className="mt-4 flex items-start gap-2 rounded-lg border border-divider bg-deck p-3 text-ink">
                <Checkbox
                  checked={backorder}
                  onCheckedChange={(c) => setBackorder(c === true)}
                  className="mt-0.5"
                />
                <span>
                  <b className="font-medium">Create a backorder</b> for the quantities not done now.
                  <span className="block text-xs text-muted-foreground">
                    Untick to close the document and drop the remainder.
                  </span>
                </span>
              </label>
            )}
          </>
        ) : (
          'The document is closed without moving any stock. This cannot be undone.'
        )
      }
      confirmLabel={pending?.kind === 'validate' ? 'Validate' : 'Cancel document'}
      tone={pending?.kind === 'cancel' ? 'danger' : 'default'}
      busy={busy}
      onConfirm={async () => {
        if (!pending) return;
        const { kind, op, before, partial } = pending;
        await run(
          async () => {
            await before?.();
            return api.post<OperationDetail>(
              `/operations/${op.id}/${kind}`,
              kind === 'validate' && partial ? { createBackorder: backorder } : {},
            );
          },
          (o) => {
            if (kind === 'cancel') return `${o.reference} canceled`;
            const bo = o.backorders.at(-1);
            return bo
              ? `${o.reference} validated. Remainder moved to backorder ${bo.reference}`
              : `${o.reference} validated: stock updated`;
          },
        );
        setPending(null);
      }}
    />
  );

  return {
    busy,
    confirm,
    requestValidate: (op: OpRef, before?: () => Promise<unknown>, partial = false) => {
      setBackorder(true);
      setPending({ kind: 'validate', op, before, partial });
    },
    requestCancel: (op: OpRef) => setPending({ kind: 'cancel', op }),
    dialog,
  };
}
