import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { FormField } from '@/components/common/FormField';
import { FilterSelect } from '@/components/common/FilterSelect';
import { PageHeader } from '@/components/common/PageHeader';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Panel, SectionHeaderBar } from '@/components/common/SectionHeaderBar';
import { useApiMutation } from '@/hooks/useMasterData';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, initials, roleLabel } from '@/lib/format';
import type { User, UserStats } from '@/lib/types';
import { passwordRule } from '@/lib/validation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth';
import { useWarehouse } from '@/providers/warehouse';

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  return {
    pct: (s / 5) * 100,
    label: labels[s] ?? 'Weak',
    tone: s <= 1 ? 'bg-danger' : s <= 3 ? 'bg-warning' : 'bg-success',
  };
}

const PERMISSIONS = {
  MANAGER:
    'Full access: products, categories, warehouses and locations, plus all operations and adjustments.',
  STAFF:
    'Operations access: view everything; create, confirm and validate receipts, deliveries, transfers and adjustments.',
};

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const { warehouses, warehouseId, setWarehouseId } = useWarehouse();
  const stats = useQuery({
    queryKey: ['me', 'stats'],
    queryFn: () => api.get<UserStats>('/auth/me/stats'),
  });
  const [name, setName] = useState(user?.name ?? '');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState<string | null>(null);

  const saveName = useApiMutation((n: string) => api.patch<User>('/auth/me', { name: n }), {
    success: 'Profile updated',
  });
  const savePw = useApiMutation(
    () => api.patch<User>('/auth/me', { currentPassword: pw.current, newPassword: pw.next }),
    { success: 'Password changed' },
  );

  if (!user) return null;
  const meter = strength(pw.next);

  const submitName = (e: FormEvent) => {
    e.preventDefault();
    saveName.mutate(name.trim(), { onSuccess: (u) => setUser(u) });
  };
  const submitPw = (e: FormEvent) => {
    e.preventDefault();
    const rule = passwordRule.safeParse(pw.next);
    if (!rule.success) return setPwError(rule.error.issues[0]?.message ?? 'Invalid password');
    if (pw.next !== pw.confirm) return setPwError('Passwords do not match');
    setPwError(null);
    savePw.mutate(undefined, { onSuccess: () => setPw({ current: '', next: '', confirm: '' }) });
  };

  const rows = [
    { icon: CheckCircle2, label: 'Operations validated', value: stats.data?.operationsValidated },
    { icon: SlidersHorizontal, label: 'Adjustments logged', value: stats.data?.adjustmentsLogged },
    {
      icon: Clock,
      label: 'Last stock activity',
      value: stats.data
        ? stats.data.lastActivityAt
          ? fmtDateTime(stats.data.lastActivityAt)
          : 'None yet'
        : undefined,
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Settings' }, { label: 'My Profile' }]}
        title="My Profile"
        subtitle="Your account details, activity and password."
      />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Panel className="p-6 text-center">
            <span className="mx-auto flex size-20 items-center justify-center rounded-xl bg-plum-deep font-display text-2xl font-bold text-white">
              {initials(user.name)}
            </span>
            <h2 className="mt-3 font-display text-headline-md font-semibold">{user.name}</h2>
            <span className="mt-1 inline-block rounded-full bg-plum-tint px-3 py-0.5 text-xs font-semibold tracking-wide text-plum uppercase">
              {roleLabel(user.role)}
            </span>
            <p className="mt-3 text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" /> Member since {fmtDate(user.createdAt)}
            </p>

            <div className="mt-6 border-t border-divider pt-4 text-left">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <Activity className="size-3.5" /> Activity overview
              </p>
              <ul className="space-y-2">
                {rows.map((r) => (
                  <li
                    key={r.label}
                    className="flex items-center gap-3 rounded-lg bg-deck px-3 py-2.5 text-sm"
                  >
                    <r.icon className="size-4 text-muted-foreground" />
                    <span className="flex-1 text-ink">{r.label}</span>
                    {r.value === undefined ? (
                      <Skeleton className="h-4 w-10" />
                    ) : (
                      <b className="font-mono text-xs">{r.value}</b>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 rounded-lg border border-info-fg/15 bg-info-bg p-3 text-left text-sm text-info-fg">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="size-4" /> Permissions
              </p>
              <p className="mt-1">{PERMISSIONS[user.role]}</p>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <SectionHeaderBar icon={UserRound} title="Personal information" />
            <form onSubmit={submitName} className="grid gap-5 p-6 sm:grid-cols-2">
              <FormField label="Full name" htmlFor="name">
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
              <FormField
                label="Email address"
                htmlFor="email"
                hint="Contact a manager to change your email."
              >
                <Input id="email" value={user.email} disabled />
              </FormField>
              <FormField
                label="Default warehouse"
                hint="Used as the starting filter across the app on this device."
              >
                <FilterSelect
                  ariaLabel="Default warehouse"
                  className="h-[42px] w-full"
                  icon={<Building2 className="size-4 text-muted-foreground" />}
                  value={warehouseId ? String(warehouseId) : 'all'}
                  onChange={(v) => setWarehouseId(v && v !== 'all' ? Number(v) : null)}
                  options={[
                    { value: 'all', label: 'All warehouses' },
                    ...warehouses.map((w) => ({
                      value: String(w.id),
                      label: `${w.code} · ${w.name}`,
                    })),
                  ]}
                />
              </FormField>
              <div className="flex items-end justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setName(user.name)}
                  disabled={name === user.name}
                >
                  Discard
                </Button>
                <Button
                  type="submit"
                  disabled={
                    saveName.isPending || name.trim().length < 2 || name.trim() === user.name
                  }
                >
                  {saveName.isPending && <Loader2 className="animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          </Panel>

          <Panel>
            <SectionHeaderBar icon={KeyRound} title="Security" />
            <form onSubmit={submitPw} className="space-y-5 p-6">
              <FormField label="Current password" htmlFor="current">
                <PasswordInput
                  id="current"
                  autoComplete="current-password"
                  value={pw.current}
                  onChange={(e) => setPw({ ...pw, current: e.target.value })}
                />
              </FormField>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="New password" htmlFor="next">
                  <PasswordInput
                    id="next"
                    autoComplete="new-password"
                    value={pw.next}
                    onChange={(e) => setPw({ ...pw, next: e.target.value })}
                  />
                </FormField>
                <FormField label="Confirm new password" htmlFor="confirm">
                  <PasswordInput
                    id="confirm"
                    autoComplete="new-password"
                    value={pw.confirm}
                    onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                  />
                </FormField>
              </div>
              {pw.next && (
                <div className="rounded-lg bg-deck p-3">
                  <div className="mb-1.5 flex justify-between text-xs font-medium">
                    <span>Password strength</span>
                    <span>{meter.label}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-divider">
                    <div
                      className={cn('h-full rounded-full transition-all', meter.tone)}
                      style={{ width: `${meter.pct}%` }}
                    />
                  </div>
                </div>
              )}
              {pwError && (
                <p role="alert" className="text-sm text-danger">
                  {pwError}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={savePw.isPending || !pw.current || !pw.next}>
                  {savePw.isPending && <Loader2 className="animate-spin" />}
                  <ShieldCheck /> Update password
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
