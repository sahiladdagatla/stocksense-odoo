import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { SectionHeaderBar } from '@/components/common/SectionHeaderBar';
import { apiUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Illustrates how every operation lands in the ledger. Example rows, not live data. */
const EXAMPLE_MOVES = [
  { qty: '+100 kg', sign: 1, sku: 'RM-STL-001', route: 'Vendors → WH1/Stock', label: 'Receipt' },
  {
    qty: '−20 pcs',
    sign: -1,
    sku: 'FU-CHR-001',
    route: 'WH1/Stock → Customers',
    label: 'Delivery',
  },
  { qty: '±0', sign: 0, sku: 'RM-CPR-003', route: 'Rack A → Rack B', label: 'Transfer' },
  {
    qty: '−3 kg',
    sign: -1,
    sku: 'RM-STL-001',
    route: 'WH1/Stock → Inventory Loss',
    label: 'Adjustment',
  },
];

function SystemStatus() {
  const { data, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await fetch(apiUrl('/health'))).ok,
    refetchInterval: 30_000,
  });
  const ok = data === true && !isError;
  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className={cn('size-2 rounded-full', ok ? 'bg-success' : 'bg-warning')} aria-hidden />
      {data === undefined && !isError
        ? 'Checking…'
        : ok
          ? 'System operational'
          : 'Server unreachable'}
    </span>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b border-divider bg-canvas">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo to="/login" />
          <SystemStatus />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-16">
        <section className="hidden lg:block" aria-hidden>
          <h1 className="font-display text-[56px] leading-[1.08] font-bold tracking-[-0.02em] text-ink">
            Every unit,
            <br />
            <span className="relative">
              accounted for.
              <svg
                viewBox="0 0 200 12"
                className="absolute -bottom-3 left-0 h-3 w-48 text-mint"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 8 C 40 2, 80 12, 120 6 S 180 4, 198 7"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="mt-8 max-w-md text-[17px] text-muted-foreground">
            Receipts, deliveries, transfers and adjustments in one live, auditable ledger.
          </p>
          <div className="mt-8 max-w-xl overflow-hidden rounded-lg border border-divider bg-canvas">
            <SectionHeaderBar icon={ArrowUpDown} title="How the ledger works" badge="Example" />
            <ul className="divide-y divide-divider">
              {EXAMPLE_MOVES.map((m) => (
                <li key={m.label} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span
                    className={cn(
                      'w-16 font-mono text-[13px] font-semibold',
                      m.sign > 0 && 'text-success',
                      m.sign < 0 && 'text-danger',
                      m.sign === 0 && 'text-muted-foreground',
                    )}
                  >
                    {m.qty}
                  </span>
                  <span className="rounded border border-divider bg-deck px-2 py-0.5 font-mono text-xs">
                    {m.sku}
                  </span>
                  <span className="flex-1 truncate text-ink">{m.route}</span>
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-divider bg-deck px-5 py-2.5 text-xs text-muted-foreground">
              Append-only: every change is a move between two locations, so stock always reconciles.
            </p>
          </div>
        </section>
        <section className="mx-auto w-full max-w-md rounded-lg border border-divider bg-canvas p-6 sm:p-8">
          {children}
        </section>
      </main>
    </div>
  );
}

export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 border-b border-divider pb-5">
      <h2 className="font-display text-headline-md font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
