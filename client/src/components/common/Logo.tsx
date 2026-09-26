import { Link } from 'react-router-dom';

export function Logo({ to = '/dashboard' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2" aria-label="StockSense home">
      <span className="font-display text-[22px] font-bold tracking-tight text-plum-deep dark:text-plum">
        stocksense
      </span>
      <span className="rounded-md bg-plum-tint px-1.5 py-0.5 text-[11px] font-bold text-plum">
        ERP
      </span>
    </Link>
  );
}
