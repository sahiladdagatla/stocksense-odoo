import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Check,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/common/Logo';
import { api, ApiError } from '@/lib/api';
import { initials, roleLabel } from '@/lib/format';
import type { Paged } from '@/lib/types';
import { useAuth } from '@/providers/auth';
import { useTheme } from '@/providers/theme';
import { useWarehouse } from '@/providers/warehouse';

const REFERENCE = /^[A-Z0-9]{2,8}\/(IN|OUT|INT|ADJ)\/\d+$/i;
const OP_ROUTE: Record<string, string> = {
  RECEIPT: 'receipts',
  DELIVERY: 'deliveries',
  INTERNAL: 'transfers',
  ADJUSTMENT: 'adjustments',
};

/**
 * Global search. Enter jumps straight to an exact SKU or document reference;
 * otherwise it opens the product list filtered by the text.
 */
function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setBusy(true);
    try {
      if (REFERENCE.test(term)) {
        const res = await api.get<Paged<{ id: number; type: string; reference: string }>>(
          '/operations',
          { search: term, pageSize: 5 },
        );
        const hit = res.items.find((o) => o.reference.toLowerCase() === term.toLowerCase());
        if (hit) {
          navigate(
            hit.type === 'ADJUSTMENT'
              ? `/moves?search=${encodeURIComponent(hit.reference)}`
              : `/${OP_ROUTE[hit.type]}/${hit.id}`,
          );
          setQ('');
          return;
        }
      }
      try {
        const product = await api.get<{ id: number }>(`/products/sku/${encodeURIComponent(term)}`);
        navigate(`/products/${product.id}`);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err;
        navigate(`/products?search=${encodeURIComponent(term)}`);
      }
      setQ('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} role="search" className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={busy}
        placeholder="Search products, SKUs, references…"
        aria-label="Search products, SKUs or references"
        className="h-10 w-full rounded-lg border border-divider bg-canvas pr-3 pl-9 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-plum focus:ring-[3px] focus:ring-plum/25"
      />
    </form>
  );
}

function WarehouseSwitcher() {
  const { warehouses, current, setWarehouseId } = useWarehouse();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 gap-2 font-normal">
          <Building2 className="size-4 text-muted-foreground" />
          <span className="max-w-44 truncate">
            {current ? `${current.code} · ${current.name}` : 'All warehouses'}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Working warehouse</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setWarehouseId(null)}>
          <Check className={current ? 'invisible' : ''} /> All warehouses
        </DropdownMenuItem>
        {warehouses.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => setWarehouseId(w.id)}>
            <Check className={current?.id === w.id ? '' : 'invisible'} />
            <span className="font-mono text-xs">{w.code}</span> {w.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-row-hover"
          aria-label="Account menu"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-plum-deep text-sm font-semibold text-white">
            {initials(user.name)}
          </span>
          <span className="hidden text-sm font-medium text-ink md:inline">{user.name}</span>
          <ChevronDown className="hidden size-4 text-muted-foreground md:inline" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs font-normal text-muted-foreground">{roleLabel(user.role)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}>
          <UserRound /> My Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggle}>
          {theme === 'dark' ? <Sun /> : <Moon />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-danger focus:text-danger">
          <LogOut className="text-danger" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-divider bg-canvas px-4 lg:gap-6 lg:px-5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>
      <div className="w-auto shrink-0 lg:w-52">
        <Logo />
      </div>
      <div className="hidden flex-1 sm:block">
        <GlobalSearch />
      </div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden md:block">
          <WarehouseSwitcher />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}

/** Search shown under the top bar on phones, where the header has no room for it. */
export function MobileSearch() {
  return (
    <div className="border-b border-divider bg-canvas px-4 py-2 sm:hidden">
      <GlobalSearch />
    </div>
  );
}
