import type { Role } from './types';

const qtyFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
const intFmt = new Intl.NumberFormat('en-IN');

export const fmtQty = (n: number) => qtyFmt.format(n);
export const fmtInt = (n: number) => intFmt.format(n);

export const fmtDateTime = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const fmtDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const fmtTime = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

export const roleLabel = (role: Role) =>
  role === 'MANAGER' ? 'Inventory Manager' : 'Warehouse Staff';
