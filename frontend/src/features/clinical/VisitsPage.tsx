import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Visit, VisitStatus } from '@/types/api';
import { visitsApi, type VisitInput } from '@/services/hms';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuth } from '@/features/auth/auth-context';
import { useToast } from '@/components/feedback/toast-context';
import { formatDateTime, humanize } from '@/utils/format';
import { statusTone, visitStatuses } from '@/utils/status';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, PageHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Display';
import { VisitForm } from './VisitForm';

export function VisitsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPatientId = searchParams.get('patientId') ?? '';
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'CLINICIAN' || user?.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(() => Boolean(initialPatientId));
  const [formError, setFormError] = useState<unknown>(null);
  const debouncedSearch = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ['visits', { search: debouncedSearch, status, page }],
    queryFn: () =>
      visitsApi.list({
        page,
        pageSize: 20,
        search: debouncedSearch || undefined,
        status: (status || undefined) as VisitStatus | undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: VisitInput) => visitsApi.create(input),
    onSuccess: (visit) => {
      toast({
        title: 'Visit created',
        description: `${visit.visitNumber} · ${visit.patient.firstName} ${visit.patient.lastName}`,
      });
      setCreating(false);
      setFormError(null);
      if (initialPatientId) setSearchParams({}, { replace: true });
      void queryClient.invalidateQueries({ queryKey: ['visits'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate(`/clinician/visits/${visit.id}`);
    },
    onError: (error) => setFormError(error),
  });

  const rows = query.data?.visits ?? [];
  const pagination = query.data?.pagination;

  const columns: Array<Column<Visit>> = [
    {
      key: 'patient',
      header: 'Patient',
      render: (visit) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={visit.patient.firstName} lastName={visit.patient.lastName} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">
              {visit.patient.firstName} {visit.patient.lastName}
            </p>
            <p className="text-xs text-slate-500">{visit.patient.patientNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'visit',
      header: 'Visit',
      render: (visit) => (
        <div>
          <p className="text-sm font-medium text-slate-700">{visit.visitNumber}</p>
          <p className="text-xs text-slate-500">{formatDateTime(visit.startedAt)}</p>
        </div>
      ),
    },
    {
      key: 'doctor',
      header: 'Doctor',
      render: (visit) => (
        <div>
          <p className="text-sm text-slate-700">
            Dr. {visit.doctor.firstName} {visit.doctor.lastName}
          </p>
          <p className="text-xs text-slate-500">{visit.doctor.specialization}</p>
        </div>
      ),
    },
    {
      key: 'diagnosis',
      header: 'Diagnosis',
      render: (visit) => (
        <p className="max-w-64 truncate text-sm text-slate-600">{visit.diagnosis ?? 'Not recorded'}</p>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (visit) => (
        <Badge tone={statusTone(visit.status)} dot>
          {humanize(visit.status)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (visit) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/clinician/visits/${visit.id}`);
          }}
        >
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinical records"
        title="Visits"
        description="Review encounters, record assessments and manage the clinical record for each visit."
        actions={
          canManage ? (
            <Button onClick={() => {
              setFormError(null);
              setCreating(true);
            }}>
              New visit
            </Button>
          ) : null
        }
      />

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              className="sm:max-w-xs"
              placeholder="Search patient, visit, diagnosis"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <Select
              className="sm:w-40"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {visitStatuses.map((item) => (
                <option key={item} value={item}>
                  {humanize(item)}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-slate-500">
            {pagination ? `${pagination.total} visits` : 'Loading…'}
          </p>
        </div>

        {query.isError ? (
          <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(visit) => visit.id}
              loading={query.isPending}
              onRowClick={(visit) => navigate(`/clinician/visits/${visit.id}`)}
              empty={
                <EmptyState
                  title="No visits found"
                  description={canManage ? 'Create a visit to begin documenting care.' : 'No visits match the selected filters.'}
                />
              }
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
        open={creating}
        onClose={() => {
          setCreating(false);
          setFormError(null);
          if (initialPatientId) setSearchParams({}, { replace: true });
        }}
        title="New visit"
        description="Create an encounter and record the initial clinical assessment."
        size="xl"
      >
        {creating ? (
          <VisitForm
            initialPatientId={initialPatientId || undefined}
            pending={createMutation.isPending}
            error={formError}
            onSubmit={(input) => createMutation.mutate(input)}
            onCancel={() => {
              setCreating(false);
              setFormError(null);
              if (initialPatientId) setSearchParams({}, { replace: true });
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
