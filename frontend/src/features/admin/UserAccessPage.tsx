import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UserAccount, UserRole, UserStatus } from '@/types/api';
import { adminApi } from '@/services/hms';
import { formatDate, formatDateTime, humanize } from '@/utils/format';
import { statusTone } from '@/utils/status';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { Card, PageHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Avatar, StatCard } from '@/components/ui/Display';
import { Modal } from '@/components/ui/Modal';
import { DetailRow } from '@/components/feedback/FormBits';

const roles: UserRole[] = ['ADMIN', 'FRONT_DESK', 'CLINICIAN', 'PATIENT'];
const statuses: UserStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

export function UserAccessPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [selected, setSelected] = useState<UserAccount | null>(null);

  const query = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.users(),
  });

  const users = useMemo(() => query.data ?? [], [query.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      if (role && user.role !== role) return false;
      if (status && user.status !== status) return false;
      if (!term) return true;
      return `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(term);
    });
  }, [users, search, role, status]);

  const counts = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.status === 'ACTIVE').length,
      clinicians: users.filter((user) => user.role === 'CLINICIAN').length,
      suspended: users.filter((user) => user.status === 'SUSPENDED').length,
    }),
    [users],
  );

  const columns: Array<Column<UserAccount>> = [
    {
      key: 'user',
      header: 'Account',
      render: (user) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={user.firstName} lastName={user.lastName} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => <Badge tone="info">{humanize(user.role)}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => (
        <Badge tone={statusTone(user.status)} dot>
          {humanize(user.status)}
        </Badge>
      ),
    },
    {
      key: 'linked',
      header: 'Linked record',
      render: (user) =>
        user.doctor ? (
          <span className="text-sm text-slate-600">Doctor profile</span>
        ) : user.staff ? (
          <span className="text-sm text-slate-600">Staff profile</span>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        ),
    },
    {
      key: 'login',
      header: 'Last login',
      render: (user) => (
        <span className="text-xs text-slate-500">
          {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (user) => <span className="text-xs text-slate-500">{formatDate(user.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access control"
        title="User access"
        description="Inventory of hospital accounts and their role-based access assignments."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accounts" value={String(counts.total)} hint="All provisioned users" />
        <StatCard label="Active" value={String(counts.active)} hint="Can currently sign in" />
        <StatCard label="Clinicians" value={String(counts.clinicians)} hint="Clinical access role" />
        <StatCard label="Suspended" value={String(counts.suspended)} hint="Access blocked" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            className="sm:max-w-xs"
            placeholder="Search name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            className="sm:w-44"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole | '')}
          >
            <option value="">All roles</option>
            {roles.map((item) => (
              <option key={item} value={item}>
                {humanize(item)}
              </option>
            ))}
          </Select>
          <Select
            className="sm:w-44"
            value={status}
            onChange={(event) => setStatus(event.target.value as UserStatus | '')}
          >
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {humanize(item)}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-500 sm:ml-auto">{filtered.length} shown</p>
        </div>
      </Card>

      <Card padding="none">
        {query.isError ? (
          <ErrorState
            message={query.error instanceof Error ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            getRowId={(user) => user.id}
            loading={query.isPending}
            onRowClick={(user) => setSelected(user)}
            empty={<EmptyState title="No accounts found" description="Adjust the search or filters." />}
          />
        )}
      </Card>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.firstName} ${selected.lastName}` : 'Account'}
        description={selected?.email}
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
              <Avatar firstName={selected.firstName} lastName={selected.lastName} size="lg" />
              <div>
                <p className="text-lg font-semibold text-slate-950">
                  {selected.firstName} {selected.lastName}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone="info">{humanize(selected.role)}</Badge>
                  <Badge tone={statusTone(selected.status)} dot>
                    {humanize(selected.status)}
                  </Badge>
                </div>
              </div>
            </div>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="Phone" value={selected.phone ?? '—'} />
              <DetailRow label="Last login" value={selected.lastLoginAt ? formatDateTime(selected.lastLoginAt) : 'Never'} />
              <DetailRow label="Created" value={formatDateTime(selected.createdAt)} />
              <DetailRow
                label="Linked doctor"
                value={selected.doctor ? selected.doctor.id : '—'}
              />
              <DetailRow
                label="Linked staff"
                value={selected.staff ? selected.staff.id : '—'}
              />
            </dl>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Account provisioning and role changes are managed through hospital onboarding and the
              identity administration process.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
