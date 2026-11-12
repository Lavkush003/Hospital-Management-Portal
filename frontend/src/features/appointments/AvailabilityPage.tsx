import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { AvailableDoctor } from '@/types/api';
import { appointmentsApi, departmentsApi } from '@/services/hms';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { addDays, endOfDay, fromDateInput, startOfDay, toDateInput } from '@/utils/date';
import { formatDateTime, formatMoney } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Avatar } from '@/components/ui/Display';

export function AvailabilityPage() {
  const today = new Date();
  const [start, setStart] = useState(toDateInput(today));
  const [end, setEnd] = useState(toDateInput(addDays(today, 7)));
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const startDate = fromDateInput(start);
  const endDate = fromDateInput(end);
  const rangeValid = startDate !== null && endDate !== null && endDate >= startDate;

  const departments = useQuery({
    queryKey: ['departments', 'options'],
    queryFn: () => departmentsApi.list({ page: 1, pageSize: 100 }),
  });

  const query = useQuery({
    queryKey: ['availability', { start, end, search: debouncedSearch, departmentId, page }],
    queryFn: () =>
      appointmentsApi.availableDoctors({
        start: startOfDay(startDate ?? today).toISOString(),
        end: endOfDay(endDate ?? today).toISOString(),
        search: debouncedSearch || undefined,
        departmentId: departmentId || undefined,
        page,
        pageSize: 12,
      }),
    enabled: rangeValid,
  });

  const doctors = query.data?.doctors ?? [];
  const pagination = query.data?.pagination;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Front desk"
        title="Doctor availability"
        description="Find doctors with open appointment slots, then book the patient into a suitable time."
        actions={
          <Link to="/front-desk/appointments">
            <Button>Go to appointments</Button>
          </Link>
        }
      />

      <Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="From" required>
            <Input
              type="date"
              value={start}
              onChange={(event) => {
                setStart(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="To" required>
            <Input
              type="date"
              value={end}
              min={start}
              onChange={(event) => {
                setEnd(event.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Department">
            <Select
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All departments</option>
              {(departments.data?.departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Doctor search">
            <Input
              placeholder="Name or specialization"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
        {!rangeValid ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Choose a valid date range. The end date must not be before the start date.
          </p>
        ) : null}
      </Card>

      {query.isError ? (
        <Card>
          <ErrorState
            message={query.error instanceof Error ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        </Card>
      ) : query.isPending ? (
        <Card>
          <p className="text-sm text-slate-500">Checking doctor availability…</p>
        </Card>
      ) : doctors.length === 0 ? (
        <Card>
          <EmptyState
            title="No available doctors"
            description="No doctors have open slots in this date range. Try a wider range or another department."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {doctors.map((doctor: AvailableDoctor) => (
              <Card key={doctor.id} className="flex flex-col">
                <div className="flex items-start gap-3">
                  <Avatar firstName={doctor.firstName} lastName={doctor.lastName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">
                      Dr. {doctor.firstName} {doctor.lastName}
                    </p>
                    <p className="truncate text-sm text-slate-500">{doctor.specialization}</p>
                    <p className="truncate text-xs text-slate-400">
                      {doctor.department?.name ?? 'No department'}
                    </p>
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {doctor.availableSlotCount} slots
                  </span>
                </div>
                <div className="mt-4 flex-1 rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Next available
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {doctor.nextAvailableSlot ? formatDateTime(doctor.nextAvailableSlot) : 'No published slot'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Consultation {formatMoney(doctor.consultationFee)}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-400">{doctor.employeeCode}</span>
                  <Link to="/front-desk/appointments">
                    <Button size="sm">Book patient</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          {pagination ? (
            <Card padding="none">
              <Pagination
                page={pagination.page}
                pageSize={pagination.pageSize}
                total={pagination.total}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
              />
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
