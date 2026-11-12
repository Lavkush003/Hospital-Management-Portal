import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Staff } from '@/types/api';
import { departmentsApi, staffApi, type StaffInput } from '@/services/hms';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useToast } from '@/components/feedback/toast-context';
import { formatDate, humanize } from '@/utils/format';
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
import { StaffForm } from './StaffForm';

type FormState = { mode: 'create' } | { mode: 'edit'; staff: Staff } | null;

export function StaffPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState>(null);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const debouncedSearch = useDebouncedValue(search);

  const departments = useQuery({
    queryKey: ['departments', 'options'],
    queryFn: () => departmentsApi.list({ page: 1, pageSize: 100 }),
  });

  const query = useQuery({
    queryKey: ['staff', { search: debouncedSearch, status, role, departmentId, page }],
    queryFn: () =>
      staffApi.list({
        page,
        pageSize: 20,
        search: debouncedSearch || undefined,
        status: (status || undefined) as Staff['status'] | undefined,
        role: (role || undefined) as 'ADMIN' | 'FRONT_DESK' | undefined,
        departmentId: departmentId || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (input: StaffInput) => staffApi.create(input),
    onSuccess: (staff) => {
      toast({
        title: 'Staff account created',
        description: `${staff.firstName} ${staff.lastName} can now sign in.`,
      });
      setForm(null);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => setFormError(error),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: StaffInput }) =>
      staffApi.update(id, input),
    onSuccess: (staff) => {
      toast({ title: 'Staff member updated', description: `${staff.firstName} ${staff.lastName}` });
      setForm(null);
      setSelected(null);
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => setFormError(error),
  });

  const rows = query.data?.staff ?? [];
  const pagination = query.data?.pagination;
  const departmentOptions = departments.data?.departments ?? [];
  const pending = createMutation.isPending || updateMutation.isPending;

  function submit(input: StaffInput) {
    setFormError(null);
    if (form?.mode === 'edit') {
      updateMutation.mutate({ id: form.staff.id, input });
    } else {
      createMutation.mutate(input);
    }
  }

  const columns: Array<Column<Staff>> = [
    {
      key: 'staff',
      header: 'Staff member',
      render: (staff) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={staff.firstName} lastName={staff.lastName} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">
              {staff.firstName} {staff.lastName}
            </p>
            <p className="text-xs text-slate-500">{staff.employeeCode}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'job',
      header: 'Job title',
      render: (staff) => (
        <div>
          <p className="text-sm text-slate-700">{staff.jobTitle}</p>
          <p className="text-xs text-slate-500">{staff.department?.name ?? 'No department'}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (staff) => (
        <div className="max-w-48">
          <p className="truncate text-sm text-slate-700">{staff.email}</p>
          <p className="truncate text-xs text-slate-500">{staff.phone ?? 'No phone'}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (staff) => (
        <Badge tone={staff.user.role === 'ADMIN' ? 'purple' : 'info'}>
          {humanize(staff.user.role)}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (staff) => (
        <Badge tone={statusTone(staff.status)} dot>
          {humanize(staff.status)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (staff) => (
        <div className="flex justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => setSelected(staff)}>
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFormError(null);
              setForm({ mode: 'edit', staff });
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
        eyebrow="Hospital operations"
        title="Staff"
        description="Manage administrative and front desk accounts, access roles and employment status."
        actions={
          <Button
            onClick={() => {
              setFormError(null);
              setForm({ mode: 'create' });
            }}
          >
            Add staff member
          </Button>
        }
      />

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
              className="sm:w-44"
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
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All roles</option>
              <option value="FRONT_DESK">Front desk</option>
              <option value="ADMIN">Administrator</option>
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
              <option value="TERMINATED">Terminated</option>
            </Select>
          </div>
          <p className="text-xs text-slate-500">
            {pagination ? `${pagination.total} staff` : 'Loading…'}
          </p>
        </div>

        {query.isError ? (
          <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(staff) => staff.id}
              loading={query.isPending}
              onRowClick={(staff) => setSelected(staff)}
              empty={
                <EmptyState
                  title="No staff found"
                  description="Adjust the filters or create a staff account."
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
        title={form?.mode === 'edit' ? 'Edit staff member' : 'Add a staff member'}
        description="Staff accounts can access the front desk or administration based on their role."
        size="lg"
      >
        {form ? (
          <StaffForm
            key={form.mode === 'edit' ? form.staff.id : 'new'}
            staff={form.mode === 'edit' ? form.staff : null}
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
        title={selected ? `${selected.firstName} ${selected.lastName}` : 'Staff member'}
        description={selected ? `${selected.employeeCode} · ${selected.jobTitle}` : undefined}
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
                  setForm({ mode: 'edit', staff: selected });
                  setSelected(null);
                }}
              >
                Edit
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
                  {selected.firstName} {selected.lastName}
                </p>
                <p className="text-sm text-slate-500">
                  {selected.jobTitle} · {selected.department?.name ?? 'No department'}
                </p>
                <div className="mt-2 flex gap-2">
                  <Badge tone={selected.user.role === 'ADMIN' ? 'purple' : 'info'}>
                    {humanize(selected.user.role)}
                  </Badge>
                  <Badge tone={statusTone(selected.status)}>{humanize(selected.status)}</Badge>
                </div>
              </div>
            </div>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Email" value={selected.email} />
              <DetailRow label="Phone" value={selected.phone ?? '—'} />
              <DetailRow label="Employee code" value={selected.employeeCode} />
              <DetailRow label="Hire date" value={selected.hiredAt ? formatDate(selected.hiredAt) : '—'} />
              <DetailRow label="Account status" value={humanize(selected.user.status)} />
              <DetailRow
                label="Last sign-in"
                value={selected.user.lastLoginAt ? formatDate(selected.user.lastLoginAt) : 'Never'}
              />
            </dl>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
