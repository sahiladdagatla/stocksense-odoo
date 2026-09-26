import { useState } from 'react';
import { MoreVertical, ShieldCheck, UserCheck, UserMinus, UserRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DataTable, type Column } from '@/components/common/DataTable';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState } from '@/components/common/States';
import { useApiMutation, useUsers } from '@/hooks/useMasterData';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtInt, initials, roleLabel } from '@/lib/format';
import type { OrgUser, Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

type Change = { user: OrgUser; role?: Role; active?: boolean } | null;

function describe(c: NonNullable<Change>) {
  if (c.role === 'MANAGER')
    return {
      title: `Make ${c.user.name} a manager?`,
      body: 'Managers can create and edit products, categories, warehouses, locations and users.',
      cta: 'Make manager',
    };
  if (c.role === 'STAFF')
    return {
      title: `Change ${c.user.name} to staff?`,
      body: 'They keep running operations but lose access to master data and user management.',
      cta: 'Change to staff',
    };
  if (c.active === false)
    return {
      title: `Deactivate ${c.user.name}?`,
      body: 'They are signed out everywhere and can no longer sign in. Their history stays in the ledger. You can reactivate them later.',
      cta: 'Deactivate',
    };
  return {
    title: `Reactivate ${c.user.name}?`,
    body: 'They will be able to sign in again with their existing password.',
    cta: 'Reactivate',
  };
}

export function UsersPage() {
  const { user: me } = useAuth();
  const users = useUsers();
  const [change, setChange] = useState<Change>(null);
  const save = useApiMutation(
    (c: NonNullable<Change>) =>
      api.patch(`/users/${c.user.id}`, { role: c.role, active: c.active }),
    { success: 'User updated', invalidate: ['users'] },
  );

  const columns: Column<OrgUser>[] = [
    {
      key: 'name',
      header: 'User',
      cell: (u) => (
        <div className={cn('flex items-center gap-3', !u.active && 'opacity-60')}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-plum-tint text-xs font-bold text-plum">
            {initials(u.name)}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-ink">
              {u.name}{' '}
              {u.id === me?.id && (
                <span className="text-xs font-normal text-muted-foreground">(you)</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (u) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
            u.role === 'MANAGER' ? 'bg-plum-tint text-plum' : 'bg-deck text-ink',
          )}
        >
          {u.role === 'MANAGER' ? (
            <ShieldCheck className="size-3.5" />
          ) : (
            <UserRound className="size-3.5" />
          )}
          {roleLabel(u.role)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (u) => (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-sm',
            u.active ? 'text-success' : 'text-muted-foreground',
          )}
        >
          <span className={cn('size-2 rounded-full', u.active ? 'bg-success' : 'bg-draft')} />{' '}
          {u.active ? 'Active' : 'Deactivated'}
        </span>
      ),
    },
    {
      key: 'moves',
      header: 'Ledger entries',
      align: 'right',
      hideBelow: 'md',
      cell: (u) => <span className="font-mono text-[13px]">{fmtInt(u.movesRecorded)}</span>,
    },
    {
      key: 'last',
      header: 'Last activity',
      hideBelow: 'lg',
      cell: (u) => (
        <span className="text-sm text-muted-foreground">
          {u.lastActivityAt ? fmtDateTime(u.lastActivityAt) : 'None yet'}
        </span>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      hideBelow: 'xl',
      cell: (u) => <span className="text-sm text-muted-foreground">{fmtDate(u.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (u) =>
        u.id === me?.id ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`}>
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {u.role === 'STAFF' ? (
                <DropdownMenuItem onSelect={() => setChange({ user: u, role: 'MANAGER' })}>
                  <ShieldCheck /> Make manager
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setChange({ user: u, role: 'STAFF' })}>
                  <UserRound /> Change to staff
                </DropdownMenuItem>
              )}
              {u.active ? (
                <DropdownMenuItem
                  className="text-danger focus:text-danger"
                  onSelect={() => setChange({ user: u, active: false })}
                >
                  <UserMinus className="text-danger" /> Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setChange({ user: u, active: true })}>
                  <UserCheck /> Reactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
    },
  ];

  const d = change ? describe(change) : null;
  const managers = users.data?.filter((u) => u.role === 'MANAGER' && u.active).length ?? 0;

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Settings' }, { label: 'Users & Roles' }]}
        title="Users & Roles"
        subtitle={
          users.data
            ? `${users.data.length} people · ${managers} active manager${managers === 1 ? '' : 's'}. New sign-ups join as staff.`
            : undefined
        }
      />
      {users.error ? (
        <ErrorState error={users.error} onRetry={() => void users.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={users.data}
          rowKey={(u) => u.id}
          loading={users.isLoading}
          empty={<EmptyState icon={Users} title="No users" />}
        />
      )}
      <ConfirmDialog
        open={!!change}
        onOpenChange={(o) => !o && setChange(null)}
        title={d?.title ?? ''}
        description={d?.body}
        confirmLabel={d?.cta ?? 'Confirm'}
        tone={change?.active === false || change?.role === 'STAFF' ? 'danger' : 'default'}
        busy={save.isPending}
        onConfirm={() => change && save.mutate(change, { onSettled: () => setChange(null) })}
      />
    </>
  );
}
