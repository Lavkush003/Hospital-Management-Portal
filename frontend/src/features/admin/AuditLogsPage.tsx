import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AuditLog } from '@/types/api';
import { adminApi } from '@/services/hms';
import { addDays, endOfDay, fromDateInput, startOfDay, toDateInput } from '@/utils/date';
import { formatDateTime, humanize } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Card, PageHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { DetailRow } from '@/components/feedback/FormBits';

export function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [outcome, setOutcome] = useState<'SUCCESS' | 'FAILURE' | ''>('');
  const [from, setFrom] = useState(() => toDateInput(addDays(new Date(), -7)));
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const range = useMemo(() => {
    const start = fromDateInput(from);
    const end = fromDateInput(to);
    if (!start || !end || start > end) return { from: undefined, to: undefined, invalid: true };
    return { from: startOfDay(start).toISOString(), to: endOfDay(end).toISOString(), invalid: false };
  }, [from, to]);

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminApi.users(),
  });

  const query = useQuery({
    queryKey: ['audit-logs', { search, action, entityType, actorUserId, outcome, range, page }],
    queryFn: () =>
      adminApi.auditLogs({
        page,
        pageSize: 25,
        action: action.trim() || undefined,
        entityType: entityType.trim() || undefined,
        actorUserId: actorUserId || undefined,
        search: search.trim() || undefined,
        outcome: outcome || undefined,
        from: range.from,
        to: range.to,
      }),
    enabled: !range.invalid,
  });

  const logs = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  const columns: Array<Column<AuditLog>> = [
    {
      key: 'time',
      header: 'Time',
      render: (log) => <span className="text-xs text-slate-600">{formatDateTime(log.createdAt)}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (log) =>
        log.actor ? (
          <div>
            <p className="text-sm font-medium text-slate-800">
              {log.actor.firstName} {log.actor.lastName}
            </p>
            <p className="text-xs text-slate-500">{humanize(log.actor.role)}</p>
          </div>
        ) : (
          <span className="text-xs text-slate-400">System</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (log) => (
        <span className="text-sm font-medium text-slate-800">{humanize(log.action)}</span>
      ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (log) => (
        <Badge tone={log.outcome === 'SUCCESS' ? 'success' : 'danger'} dot>
          {humanize(log.outcome)}
        </Badge>
      ),
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (log) => (
        <div>
          <p className="text-sm text-slate-700">{humanize(log.entityType)}</p>
          <p className="max-w-40 truncate font-mono text-xs text-slate-400">{log.entityId}</p>
        </div>
      ),
    },
    {
      key: 'request',
      header: 'Request',
      render: (log) => (
        <span className="max-w-36 truncate font-mono text-xs text-slate-500">{log.requestId ?? '—'}</span>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      render: (log) => <span className="text-xs text-slate-500">{log.ipAddress ?? '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Audit logs"
        description="Immutable record of security-sensitive actions across the hospital system."
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="audit-search">
              Search
            </label>
            <Input
              id="audit-search"
              placeholder="Action, actor, resource, request"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="audit-action">
              Action
            </label>
            <Input
              id="audit-action"
              placeholder="e.g. READ"
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="audit-outcome">
              Outcome
            </label>
            <Select
              id="audit-outcome"
              value={outcome}
              onChange={(event) => {
                setOutcome(event.target.value as 'SUCCESS' | 'FAILURE' | '');
                setPage(1);
              }}
            >
              <option value="">All outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="audit-entity">
              Entity type
            </label>
            <Input
              id="audit-entity"
              placeholder="e.g. Patient"
              value={entityType}
              onChange={(event) => {
                setEntityType(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="audit-actor">
              Actor
            </label>
            <Select
              id="audit-actor"
              value={actorUserId}
              onChange={(event) => {
                setActorUserId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All users</option>
              {(usersQuery.data ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} · {humanize(user.role)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="audit-from">
              From
            </label>
            <Input
              id="audit-from"
              type="date"
              value={from}
              max={to}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="audit-to">
              To
            </label>
            <Input
              id="audit-to"
              type="date"
              value={to}
              min={from}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setAction('');
                setEntityType('');
                setActorUserId('');
                setSearch('');
                setOutcome('');
                setFrom(toDateInput(addDays(new Date(), -7)));
                setTo(toDateInput(new Date()));
                setPage(1);
              }}
            >
              Reset filters
            </Button>
          </div>
        </div>
        {range.invalid ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Select a valid date range where From is on or before To.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            {pagination ? `${pagination.total} audit events` : 'Loading audit events…'}
          </p>
        )}
      </Card>

      <Card padding="none">
        {query.isError ? (
          <ErrorState
            message={query.error instanceof Error ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={logs}
              getRowId={(log) => log.id}
              loading={query.isPending}
              onRowClick={(log) => setSelected(log)}
              empty={<EmptyState title="No audit events" description="Adjust the filters or date range." />}
            />
            {pagination ? (
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Card>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? humanize(selected.action) : 'Audit event'}
        description={selected ? formatDateTime(selected.createdAt) : undefined}
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Event ID" value={<span className="font-mono text-xs">{selected.id}</span>} />
              <DetailRow
                label="Actor"
                value={
                  selected.actor
                    ? `${selected.actor.firstName} ${selected.actor.lastName} · ${selected.actor.email}`
                    : 'System'
                }
              />
              <DetailRow label="Outcome" value={humanize(selected.outcome)} />
              <DetailRow label="Entity" value={`${humanize(selected.entityType)} · ${selected.entityId}`} />
              <DetailRow label="Request ID" value={selected.requestId ?? '—'} />
              <DetailRow label="IP address" value={selected.ipAddress ?? '—'} />
              <DetailRow label="User agent" value={selected.userAgent ?? '—'} />
            </dl>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
