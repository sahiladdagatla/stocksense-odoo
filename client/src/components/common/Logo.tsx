import { Link } from 'react-router-dom';
import { LOGO_FACES } from '@/lib/logo';
import { cn } from '@/lib/utils';

/** The isometric "S" mark. Face colours come from the --logo-* tokens (light, dark, on-dark). */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('size-8 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      strokeLinejoin="round"
      strokeWidth={1.4}
    >
      {LOGO_FACES.map((f) => (
        <path key={f.d} d={f.d} fill={`var(--${f.part})`} stroke={`var(--${f.part})`} />
      ))}
    </svg>
  );
}

/** Two-tone wordmark: "stock" deep plum, "sense" plum. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-[22px] font-extrabold tracking-[-0.03em]', className)}>
      <span className="text-wordmark-stock">stock</span>
      <span className="text-wordmark-sense">sense</span>
    </span>
  );
}

export function Logo({ to = '/dashboard', erp = true }: { to?: string; erp?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2" aria-label="StockSense home">
      <LogoMark className="size-8" />
      <Wordmark />
      {erp && (
        <span className="rounded-md bg-plum-tint px-1.5 py-0.5 text-[11px] font-bold text-plum">
          ERP
        </span>
      )}
    </Link>
  );
}
