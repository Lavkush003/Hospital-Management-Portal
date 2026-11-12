import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Doctor } from '@/types/api';
import { departmentsApi, doctorsApi, type DoctorInput } from '@/services/hms';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useToast } from '@/components/feedback/toast-context';
import { formatDate, formatMoney, humanize } from '@/utils/format';
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
import { DoctorForm } from './DoctorForm';

type FormState = { mode: 'create' } | { mode: 'edit'; doctor: Doctor } | null;

export function DoctorsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState>(null);
  const [selected, setSelected] = useState<Doctor | null>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const debouncedSearch = useDebouncedValue(search);

  const departments = useQuery({
    queryKey: ['departments', 'options'],
    queryFn: () => departmentsApi.list({ page: 1, pageSize: 100 }),
  });

  const query = useQuery({
    queryKey: ['doctors', { search: debouncedSearch, status, departmentId, page }],
    queryFn: () =>
      doctorsApi.list({
        page,
        pageSize: 20,
        search: debouncedSearch || undefined,
        status: status || undefined,
        departmentId: departmentId || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: DoctorInput) => doctorsApi.create(input),
    onSuccess: (doctor) => {
      toast({
        title: 'Doctor profile created',
        description: `Dr. ${doctor.firstName} ${doctor.lastName} can now sign in.`,
      });
      setForm(null);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['doctors'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => setFormError(error),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DoctorInput }) =>
      doctorsApi.update(id, input),
    onSuccess: (doctor) => {
      toast({ title: 'Doctor updated', description: `Dr. ${doctor.firstName} ${doctor.lastName}` });
      setForm(null);
      setSelected(null);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
    onError: (error) => setFormError(error),
  });

  const rows = query.data?.doctors ?? [];
  const pagination = query.data?.pagination;
  const departmentOptions = departments.data?.departments ?? [];
  const pending = createMutation.isPending || updateMutation.isPending;

  function submit(input: DoctorInput) {
    setFormError(null);
    if (form?.mode === 'edit') {
      updateMutation.mutate({ id: form.doctor.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  const columns: Array<Column<Doctor>> = [
    {
      key: 'doctor',
      header: 'Doctor',
      render: (doctor) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={doctor.firstName} lastName={doctor.lastName} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">
              Dr. {doctor.firstName} {doctor.lastName}
            </p>
            <p className="text-xs text-slate-500">{doctor.employeeCode}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (doctor) => (
        <div>
          <p className="text-sm text-slate-700">{doctor.department?.name ?? '—'}</p>
          <p className="text-xs text-slate-500">{doctor.department?.location ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'specialization',
      header: 'Specialization',
      render: (doctor) => (
        <div>
          <p className="text-sm text-slate-700">{doctor.specialization}</p>
          <p className="text-xs text-slate-500">{formatMoney(doctor.consultationFee)}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (doctor) => (
        <div className="max-w-48">
          <p className="truncate text-sm text-slate-700">{doctor.email}</p>
          <p className="truncate text-xs text-slate-500">{doctor.phone ?? 'No phone'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (doctor) => (
        <Badge tone={statusTone(doctor.status)} dot>
          {humanize(doctor.status)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (doctor) => (
        <div className="flex justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => setSelected(doctor)}>
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFormError(null);
              setForm({ mode: 'edit', doctor });
              setSelected(null);
            }}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Care network"
        title="Doctors"
        description="Manage clinician profiles, department assignment, availability and account status."
        actions={
          <Button
            onClick={() => {
              setFormError(null);
              setForm({ mode: 'create' });
            }}
          >
            Add doctor
          </Button>
        }
      />

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              className="sm:max-w-xs"
              placeholder="Search name, code, email"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <Select
              className="sm:w-48"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
            <Select
              className="sm:w-36"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>
          <p className="text-xs text-slate-500">
            {pagination ? `${pagination.total} doctors` : 'Loading…'}
          </p>
        </div>

        {query.isError ? (
          <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(doctor) => doctor.id}
              loading={query.isPending}
              onRowClick={(doctor) => setSelected(doctor)}
              empty={
                <EmptyState
                  title="No doctors found"
                  description="Adjust the filters or add a new doctor profile."
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
        title={form?.mode === 'edit' ? 'Edit doctor profile' : 'Add a doctor'}
        description={
          form?.mode === 'edit'
            ? 'Update the clinician profile and account link.'
            : 'Create a clinician account and professional profile. The doctor signs in with this email.'
        }
        size="lg"
      >
        {form ? (
          <DoctorForm
            key={form.mode === 'edit' ? form.doctor.id : 'new'}
            doctor={form.mode === 'edit' ? form.doctor : null}
            departments={departmentOptions}
            pending={pending}
            error={formError}
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
        title={selected ? `Dr. ${selected.firstName} ${selected.lastName}` : 'Doctor'}
        description={selected ? `${selected.employeeCode} · ${selected.specialization}` : undefined}
        size="lg"
        footer={
          selected ? (
            <>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setFormError(null);
                  setForm({ mode: 'edit', doctor: selected });
                  setSelected(null);
                }}
              >
                Edit profile
              </Button>
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
                  Dr. {selected.firstName} {selected.lastName}
                </p>
                <p className="text-sm text-slate-500">
                  {selected.specialization} · {selected.department?.name ?? 'No department'}
                </p>
                <div className="mt-2 flex gap-2">
                  <Badge tone={statusTone(selected.status)}>{humanize(selected.status)}</Badge>
                  {selected.user ? (
                    <Badge tone={statusTone(selected.user.status)}>
                      Account {humanize(selected.user.status)}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="Phone" value={selected.phone ?? '—'} />
              <DetailRow label="Employee code" value={selected.employeeCode} />
              <DetailRow label="License number" value={selected.licenseNumber} />
              <DetailRow label="Consultation fee" value={formatMoney(selected.consultationFee)} />
              <DetailRow label="Qualifications" value={selected.qualifications ?? '—'} />
              <DetailRow label="Bio" value={selected.bio ?? '—'} />
              <DetailRow label="Created" value={formatDate(selected.createdAt)} />
            </dl>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
