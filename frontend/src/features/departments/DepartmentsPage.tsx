import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Department } from '@/types/api';
import { departmentsApi, doctorsApi, type DepartmentInput } from '@/services/hms';
import { errorMessage } from '@/services/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useToast } from '@/components/feedback/toast-context';
import { humanize } from '@/utils/format';
import { statusTone } from '@/utils/status';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, PageHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { DetailRow } from '@/components/feedback/FormBits';
import { DepartmentForm } from './DepartmentForm';

type FormState = { mode: 'create' } | { mode: 'edit'; department: Department } | null;

function DepartmentAssignDialog({
  department,
  onClose,
}: {
  department: Department | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const doctors = useQuery({
    queryKey: ['doctors', 'assignment'],
    queryFn: () => doctorsApi.list({ page: 1, pageSize: 100 }),
    enabled: department !== null,
  });

  const mutation = useMutation({
    mutationFn: () => departmentsApi.assignDoctors(department?.id ?? '', selected),
    onSuccess: (updated) => {
      toast({
        title: 'Doctors assigned',
        description: `${selected.length} doctor${selected.length === 1 ? '' : 's'} moved to ${updated.name}.`,
      });
      setSelected([]);
      onClose();
      void queryClient.invalidateQueries({ queryKey: ['departments'] });
      void queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
    onError: (error) => toast({ title: 'Could not assign doctors', description: errorMessage(error), tone: 'error' }),
  });

  function toggle(doctorId: string) {
    setSelected((current) =>
      current.includes(doctorId) ? current.filter((id) => id !== doctorId) : [...current, doctorId],
    );
  }

  const available = (doctors.data?.doctors ?? []).filter(
    (doctor) => doctor.departmentId !== department?.id,
  );

  return (
    <Modal
      open={department !== null}
      onClose={onClose}
      title="Assign doctors"
      description={
        department
          ? `Selected doctors will be moved into ${department.name}. Their previous department assignment will change.`
          : undefined
      }
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={selected.length === 0}
          >
            Assign {selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
        </>
      }
    >
      {doctors.isPending ? (
        <p className="text-sm text-slate-500">Loading doctors…</p>
      ) : available.length === 0 ? (
        <EmptyState
          title="No other doctors"
          description="Every doctor is already assigned to this department."
        />
      ) : (
        <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {available.map((doctor) => (
            <label
              key={doctor.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={selected.includes(doctor.id)}
                onChange={() => toggle(doctor.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">
                  Dr. {doctor.firstName} {doctor.lastName}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {doctor.employeeCode} · {doctor.department?.name ?? 'Unassigned'}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function DepartmentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState>(null);
  const [selected, setSelected] = useState<Department | null>(null);
  const [assigning, setAssigning] = useState<Department | null>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const debouncedSearch = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ['departments', { search: debouncedSearch, active, page }],
    queryFn: () =>
      departmentsApi.list({
        page,
        pageSize: 20,
        search: debouncedSearch || undefined,
        isActive: active === '' ? undefined : active === 'true',
      }),
  });

  const detail = useQuery({
    queryKey: ['departments', selected?.id],
    queryFn: () => departmentsApi.find(selected?.id ?? ''),
    enabled: selected !== null,
  });

  const createMutation = useMutation({
    mutationFn: (input: DepartmentInput) => departmentsApi.create(input),
    onSuccess: (department) => {
      toast({ title: 'Department created', description: department.name });
      setForm(null);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['departments'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => setFormError(error),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DepartmentInput }) =>
      departmentsApi.update(id, input),
    onSuccess: (department) => {
      toast({ title: 'Department updated', description: department.name });
      setForm(null);
      setSelected(null);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (error) => setFormError(error),
  });

  const rows = query.data?.departments ?? [];
  const pagination = query.data?.pagination;
  const department = detail.data;

  function submit(input: DepartmentInput) {
    setFormError(null);
    if (form?.mode === 'edit') {
      updateMutation.mutate({ id: form.department.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  const columns: Array<Column<Department>> = [
    {
      key: 'department',
      header: 'Department',
      render: (item) => (
        <div>
          <p className="font-semibold text-slate-900">{item.name}</p>
          <p className="text-xs text-slate-500">{item.code}</p>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (item) => (
        <div>
          <p className="text-sm text-slate-700">{item.location ?? '—'}</p>
          <p className="text-xs text-slate-500">{item.phone ?? 'No phone'}</p>
        </div>
      ),
    },
    {
      key: 'doctors',
      header: 'Doctors',
      render: (item) => <span className="text-sm text-slate-700">{item._count?.doctors ?? 0}</span>,
    },
    {
      key: 'staff',
      header: 'Staff',
      render: (item) => <span className="text-sm text-slate-700">{item._count?.staff ?? 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge tone={item.isActive ? 'success' : 'neutral'} dot>
          {item.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (item) => (
        <div className="flex justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => setSelected(item)}>
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFormError(null);
              setForm({ mode: 'edit', department: item });
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
        eyebrow="Hospital structure"
        title="Departments"
        description="Organize clinical services, locations and the doctors assigned to each department."
        actions={
          <Button
            onClick={() => {
              setFormError(null);
              setForm({ mode: 'create' });
            }}
          >
            Add department
          </Button>
        }
      />

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              className="sm:max-w-xs"
              placeholder="Search code, name, location"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <Select
              className="sm:w-40"
              value={active}
              onChange={(event) => {
                setActive(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </Select>
          </div>
          <p className="text-xs text-slate-500">
            {pagination ? `${pagination.total} departments` : 'Loading…'}
          </p>
        </div>

        {query.isError ? (
          <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(item) => item.id}
              loading={query.isPending}
              onRowClick={(item) => setSelected(item)}
              empty={
                <EmptyState
                  title="No departments found"
                  description="Adjust the filters or create the first department."
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
        title={form?.mode === 'edit' ? 'Edit department' : 'Add a department'}
        description="Departments group doctors and staff by clinical service."
        size="lg"
      >
        {form ? (
          <DepartmentForm
            key={form.mode === 'edit' ? form.department.id : 'new'}
            department={form.mode === 'edit' ? form.department : null}
            pending={createMutation.isPending || updateMutation.isPending}
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
        title={selected?.name ?? 'Department'}
        description={selected ? `${selected.code} · ${selected.location ?? 'No location'}` : undefined}
        size="lg"
        footer={
          selected ? (
            <>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
              <Button variant="outline" onClick={() => setAssigning(selected)}>
                Assign doctors
              </Button>
              <Button
                onClick={() => {
                  setFormError(null);
                  setForm({ mode: 'edit', department: selected });
                  setSelected(null);
                }}
              >
                Edit
              </Button>
            </>
          ) : null
        }
      >
        {detail.isPending && selected ? (
          <p className="text-sm text-slate-500">Loading department…</p>
        ) : department ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Badge tone={department.isActive ? 'success' : 'neutral'}>
                {department.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <span className="text-sm text-slate-500">
                {department._count?.doctors ?? 0} doctors · {department._count?.staff ?? 0} staff
              </span>
            </div>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Code" value={department.code} />
              <DetailRow label="Phone" value={department.phone ?? '—'} />
              <DetailRow label="Location" value={department.location ?? '—'} />
              <DetailRow label="Description" value={department.description ?? '—'} />
            </dl>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Doctors</h3>
              {department.doctors && department.doctors.length > 0 ? (
                <ul className="mt-3 divide-y divide-slate-100">
                  {department.doctors.map((doctor) => (
                    <li key={doctor.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          Dr. {doctor.firstName} {doctor.lastName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {doctor.specialization} · {doctor.employeeCode}
                        </p>
                      </div>
                      <Badge tone={statusTone(doctor.status)}>{humanize(doctor.status)}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No doctors assigned yet.</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {assigning ? (
        <DepartmentAssignDialog
          key={assigning.id}
          department={assigning}
          onClose={() => setAssigning(null)}
        />
      ) : null}
    </div>
  );
}
