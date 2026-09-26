import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ChevronDown,
  History,
  LayoutDashboard,
  Package,
  ScanLine,
  SlidersHorizontal,
  Truck,
  UsersRound,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/providers/auth';
import { initials, roleLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

type Item = { to: string; label: string; icon: LucideIcon; managerOnly?: boolean };
type Group = { label: string; items: Item[]; collapsible?: boolean };

const NAV: Group[] = [
  {
    label: 'Inventory app',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/products', label: 'Products', icon: Package },
    ],
  },
  {
    label: 'Operations',
    collapsible: true,
    items: [
      { to: '/receipts', label: 'Receipts', icon: ArrowDownToLine },
      { to: '/deliveries', label: 'Delivery Orders', icon: Truck },
      { to: '/transfers', label: 'Internal Transfers', icon: ArrowLeftRight },
      { to: '/adjustments', label: 'Adjustments', icon: SlidersHorizontal },
    ],
  },
  {
    label: 'Tracking',
    items: [
      { to: '/moves', label: 'Move History', icon: History },
      { to: '/scan', label: 'Scan Mode', icon: ScanLine },
    ],
  },
  {
    label: 'Settings',
    collapsible: true,
    items: [
      { to: '/settings/warehouses', label: 'Warehouses & Locations', icon: Warehouse },
      { to: '/settings/users', label: 'Users & Roles', icon: UsersRound, managerOnly: true },
    ],
  },
];

function NavItem({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex h-10 items-center gap-3 rounded-r-lg pr-3 pl-4 text-sm whitespace-nowrap transition-colors',
          isActive
            ? 'bg-plum-tint font-semibold text-plum-deep before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-plum dark:text-plum'
            : 'text-ink hover:bg-row-hover',
        )
      }
    >
      <Icon className="size-[18px] shrink-0 opacity-80" aria-hidden />
      {item.label}
    </NavLink>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { isManager } = useAuth();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <nav aria-label="Main" className="flex-1 space-y-4 overflow-y-auto py-4 pr-3">
      {NAV.map((group) => {
        const isCollapsed = collapsed[group.label];
        return (
          <div key={group.label}>
            {group.collapsible ? (
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [group.label]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
                className="flex w-full items-center justify-between pr-1 pb-1 pl-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                {group.label}
                <ChevronDown
                  className={cn('size-4 transition-transform', isCollapsed && '-rotate-90')}
                  aria-hidden
                />
              </button>
            ) : (
              <p className="pb-1 pl-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {group.label}
              </p>
            )}
            {!isCollapsed && (
              <div className="space-y-0.5">
                {group.items
                  .filter((item) => !item.managerOnly || isManager)
                  .map((item) => (
                    <NavItem key={item.to} item={item} onNavigate={onNavigate} />
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function SidebarUserCard({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="border-t border-divider p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-plum-deep text-sm font-semibold text-white">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{roleLabel(user.role)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[13px] font-medium">
        <Link to="/profile" onClick={onNavigate} className="text-ink hover:text-plum-nav">
          My Profile
        </Link>
        <span className="size-1 rounded-full bg-divider" aria-hidden />
        <button onClick={logout} className="text-ink hover:text-danger">
          Logout
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-16 hidden h-[calc(100svh-4rem)] w-60 shrink-0 flex-col border-r border-divider bg-sidebar lg:flex">
      <SidebarNav />
      <SidebarUserCard />
    </aside>
  );
}
