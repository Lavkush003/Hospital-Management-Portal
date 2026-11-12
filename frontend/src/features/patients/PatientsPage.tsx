import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Gender, Patient, PatientStatus } from '@/types/api';
import { patientsApi, type PatientInput } from '@/services/hms';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuth } from '@/features/auth/auth-context';
import { useToast } from '@/components/feedback/toast-context';
import { formatDate, formatDateOnly, formatDateTime, getAge, humanize } from '@/utils/format';
import { statusTone } from '@/utils/status';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, PageHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Display';
import { DetailRow } from '@/components/feedback/FormBits';
import { PatientForm } from './PatientForm';

type FormState = { mode: 'create' } | { mode: 'edit'; patient: Patient } | null;

export function PatientsPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canViewClinical = user?.role === 'ADMIN' || user?.role === 'CLINICIAN';
  const canManage = user?.role === 'ADMIN' || user?.role === 'FRONT_DESK';
  const isClinician = user?.role === 'CLINICIAN';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PatientStatus | ''>('');
  const [gender, setGender] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState>(null);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const debouncedSearch = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ['patients', { search: debouncedSearch, status, gender, page }],
    queryFn: () =>
      patientsApi.list({
        page,
        pageSize: 20,
        search: debouncedSearch || undefined,
        ...(status ? { status } : {}),
        ...(gender ? { gender: gender as Gender } : {}),
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: PatientInput) => patientsApi.create(input),
    onSuccess: (patient) => {
      toast({ title: 'Patient registered', description: `${patient.firstName} ${patient.lastName} · ${patient.patientNumber}` });
      setForm(null);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error) => setFormError(error),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PatientInput }) =>
      patientsApi.update(id, input),
    onSuccess: (patient) => {
      toast({ title: 'Patient updated', description: `${patient.firstName} ${patient.lastName}` });
      setForm(null);
      setSelected(null);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error) => setFormError(error),
  });

  const rows = query.data?.patients ?? [];
  const pagination = query.data?.pagination;
  const pending = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setFormError(null);
    setForm({ mode: 'create' });
  }

  function openEdit(patient: Patient) {
    setFormError(null);
    setForm({ mode: 'edit', patient });
    setSelected(null);
  }

  function submit(input: PatientInput) {
    setFormError(null);
    if (form?.mode === 'edit') {
      updateMutation.mutate({ id: form.patient.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  const columns: Array<Column<Patient>> = [
    {
      key: 'patient',
      header: 'Patient',
      render: (patient) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={patient.firstName} lastName={patient.lastName} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">
              {patient.firstName} {patient.lastName}
            </p>
            <p className="text-xs text-slate-500">{patient.patientNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'demographics',
      header: 'Demographics',
      render: (patient) => (
        <div>
          <p className="text-sm text-slate-700">
            {getAge(patient.dateOfBirth)} · {humanize(patient.gender)}
          </p>
          <p className="text-xs text-slate-500">{humanize(patient.bloodGroup)}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (patient) => (
        <div className="max-w-48">
          <p className="truncate text-sm text-slate-700">{patient.phone ?? 'No phone'}</p>
          <p className="truncate text-xs text-slate-500">{patient.email ?? 'No email'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (patient) => (
        <Badge tone={statusTone(patient.status)} dot>
          {humanize(patient.status)}
        </Badge>
      ),
    },
    {
      key: 'registered',
      header: 'Registered',
      render: (patient) => (
        <span className="text-xs text-slate-500">{formatDate(patient.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (patient) => (
        <div className="flex justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => setSelected(patient)}>
            View
          </Button>
          {isClinician ? (
            <Link
              to={`/clinician/patients/${patient.id}`}
              className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50"
              onClick={(event) => event.stopPropagation()}
            >
              Clinical
            </Link>
          ) : null}
          {canManage ? (
            <Button size="sm" variant="outline" onClick={() => openEdit(patient)}>
              Edit
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={canManage ? <Button onClick={openCreate}>Register patient</Button> : null}
      />

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
              </svg>
              <Input
                className="pl-9"
                placeholder="Search name, number or phone"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              className="sm:w-40"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as PatientStatus | '');
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DECEASED">Deceased</option>
            </Select>
            <Select
              className="sm:w-36"
              value={gender}
              onChange={(event) => {
                setGender(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All genders</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
              <option value="UNKNOWN">Unknown</option>
            </Select>
          </div>
          <p className="text-xs text-slate-500">
            {pagination ? `${pagination.total} patients` : 'Loading…'}
          </p>
        </div>

        {query.isError ? (
          <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(patient) => patient.id}
              loading={query.isPending}
              onRowClick={(patient) => setSelected(patient)}
              empty={
                <EmptyState
                  title="No patients found"
                  description="Try a different search or register a new patient."
                  action={canManage ? <Button size="sm" onClick={openCreate}>Register patient</Button> : undefined}
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
        open={form !== null}
        onClose={() => {
          setForm(null);
          setFormError(null);
        }}
        title={form?.mode === 'edit' ? 'Edit patient' : 'Register patient'}
        description={
          form?.mode === 'edit'
            ? `Update the record for ${form.patient.patientNumber}.`
            : 'Create a new patient record. A patient number is assigned by the hospital.'
        }
        size="lg"
      >
        {form ? (
          <PatientForm
            key={form.mode === 'edit' ? form.patient.id : 'new'}
            patient={form.mode === 'edit' ? form.patient : null}
            canEditClinical={canViewClinical}
            pending={pending}
            error={formError}
            submitLabel={form.mode === 'edit' ? 'Save changes' : 'Register patient'}
            onSubmit={submit}
            onCancel={() => {
              setForm(null);
              setFormError(null);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.firstName} ${selected.lastName}` : 'Patient'}
        description={selected ? `${selected.patientNumber} · registered ${formatDate(selected.createdAt)}` : undefined}
        size="lg"
        footer={
          selected ? (
            <>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              {isClinician ? (
                <Link to={`/clinician/patients/${selected.id}`}>
                  <Button>Open clinical record</Button>
                </Link>
              ) : canManage ? (
                <Button onClick={() => openEdit(selected)}>Edit patient</Button>
              ) : null}
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
              <Avatar firstName={selected.firstName} lastName={selected.lastName} size="lg" />
              <div>
                <p className="text-lg font-semibold text-slate-950">
                  {selected.firstName} {selected.lastName}
                </p>
                <p className="text-sm text-slate-500">
                  {getAge(selected.dateOfBirth)} · {humanize(selected.gender)} ·{' '}
                  {humanize(selected.bloodGroup)}
                </p>
                <Badge tone={statusTone(selected.status)} className="mt-2">
                  {humanize(selected.status)}
                </Badge>
              </div>
            </div>

            <dl className="divide-y divide-slate-100">
              <DetailRow label="Patient number" value={selected.patientNumber} />
              <DetailRow label="Date of birth" value={formatDateOnly(selected.dateOfBirth)} />
              <DetailRow label="Phone" value={selected.phone ?? '—'} />
              <DetailRow label="Email" value={selected.email ?? '—'} />
              <DetailRow
                label="Address"
                value={
                  [
                    selected.addressLine1,
                    selected.addressLine2,
                    selected.city,
                    selected.state,
                    selected.postalCode,
                    selected.country,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'
                }
              />
              <DetailRow
                label="Emergency contact"
                value={
                  selected.emergencyContactName
                    ? `${selected.emergencyContactName}${selected.emergencyContactPhone ? ` · ${selected.emergencyContactPhone}` : ''}`
                    : '—'
                }
              />
              {canViewClinical ? (
                <>
                  <DetailRow label="Allergies" value={selected.allergies || 'None recorded'} />
                  <DetailRow label="Notes" value={selected.notes || 'None recorded'} />
                </>
              ) : null}
              <DetailRow label="Last updated" value={formatDateTime(selected.updatedAt)} />
            </dl>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
