import {
  ArrowDownToLine,
  ArrowLeftRight,
  SlidersHorizontal,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import type { OpStatus, OpType } from './types';

export type DocType = Exclude<OpType, 'ADJUSTMENT'>;

/** Everything that differs between receipts, deliveries and transfers lives here. */
export const OP_META: Record<
  OpType,
  {
    label: string;
    plural: string;
    path: string;
    icon: LucideIcon;
    partnerLabel: string | null;
    tagline: string;
    /** Which location the user picks (the other side is virtual). */
    pick: { source: boolean; dest: boolean };
  }
> = {
  RECEIPT: {
    label: 'Receipt',
    plural: 'Receipts',
    path: '/receipts',
    icon: ArrowDownToLine,
    partnerLabel: 'Vendor',
    tagline: 'Incoming stock from vendors.',
    pick: { source: false, dest: true },
  },
  DELIVERY: {
    label: 'Delivery Order',
    plural: 'Delivery Orders',
    path: '/deliveries',
    icon: Truck,
    partnerLabel: 'Customer',
    tagline: 'Outgoing stock to customers.',
    pick: { source: true, dest: false },
  },
  INTERNAL: {
    label: 'Internal Transfer',
    plural: 'Internal Transfers',
    path: '/transfers',
    icon: ArrowLeftRight,
    partnerLabel: null,
    tagline: 'Stock moved between your own locations.',
    pick: { source: true, dest: true },
  },
  ADJUSTMENT: {
    label: 'Adjustment',
    plural: 'Adjustments',
    path: '/adjustments',
    icon: SlidersHorizontal,
    partnerLabel: null,
    tagline: 'Physical count corrections.',
    pick: { source: false, dest: false },
  },
};

export const OPEN_STATUSES: OpStatus[] = ['DRAFT', 'WAITING', 'READY'];

/** "Today", "Late by 2d" etc. for documents that are still open. */
export function scheduleFlag(
  scheduled: string,
  status: OpStatus,
): { label: string; tone: 'today' | 'late' } | null {
  if (!OPEN_STATUSES.includes(status)) return null;
  const d = new Date(scheduled);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startOfToday.getTime() - startOfDay.getTime()) / 86_400_000);
  if (days > 0) return { label: `Late ${days}d`, tone: 'late' };
  if (days === 0)
    return d < now ? { label: 'Due now', tone: 'late' } : { label: 'Today', tone: 'today' };
  return null;
}

/** Relative-friendly schedule text: "Today, 14:00", "Tomorrow, 09:30", "28 Sep 2026, 11:00". */
export function fmtSchedule(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dayDiff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  if (dayDiff === -1) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${time}`;
}

/** Value for <input type="datetime-local"> in the user's timezone. */
export function toLocalInput(iso: string | Date) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
