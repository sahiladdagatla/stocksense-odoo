import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { api, errorMessage } from '@/lib/api';
import type { OperationDetail, OpStatus } from '@/lib/types';

type OpRef = { id: number; reference: string; status: OpStatus };
type Pending = { kind: 'validate' | 'cancel'; op: OpRef; before?: () => Promise<unknown> } | null;

/**
 * Confirm / Validate / Cancel with the app's rules: Validate and Cancel always ask first,
 * API errors (e.g. INSUFFICIENT_STOCK) are shown verbatim, and every affected view refreshes.
 */
export function useOperationActions() {
  const qc = useQueryClient();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

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
        pending?.kind === 'validate'
          ? 'Stock will move immediately and the change is written to the ledger. This cannot be undone. Correct mistakes later with an adjustment.'
          : 'The document is closed without moving any stock. This cannot be undone.'
      }
      confirmLabel={pending?.kind === 'validate' ? 'Validate' : 'Cancel document'}
      tone={pending?.kind === 'cancel' ? 'danger' : 'default'}
      busy={busy}
      onConfirm={async () => {
        if (!pending) return;
        const { kind, op, before } = pending;
        await run(
          async () => {
            await before?.();
            return api.post<OperationDetail>(`/operations/${op.id}/${kind}`);
          },
          (o) =>
            kind === 'validate'
              ? `${o.reference} validated: stock updated`
              : `${o.reference} canceled`,
        );
        setPending(null);
      }}
    />
  );

  return {
    busy,
    confirm,
    requestValidate: (op: OpRef, before?: () => Promise<unknown>) =>
      setPending({ kind: 'validate', op, before }),
    requestCancel: (op: OpRef) => setPending({ kind: 'cancel', op }),
    dialog,
  };
}
