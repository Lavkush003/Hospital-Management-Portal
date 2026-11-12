import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Appointment, AppointmentStatus, AvailableDoctor, Patient } from '@/types/api';
import {
  appointmentsApi,
  type BookAppointmentInput,
} from '@/services/hms';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuth } from '@/features/auth/auth-context';
import { useToast } from '@/components/feedback/toast-context';
import { errorMessage } from '@/services/api';
import { formatDate, formatDateTime, formatTime, formatTimeRange, humanize } from '@/utils/format';
import { endOfDay, fromDateInput, startOfDay, toDateInput } from '@/utils/date';
import { appointmentStatuses, statusTone } from '@/utils/status';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, PageHeader } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Display';
import { DetailRow, FormError } from '@/components/feedback/FormBits';
import { PatientPicker } from '@/features/patients/PatientPicker';

function dayRange(value: string): { start: string; end: string } | null {
  const date = fromDateInput(value);
  if (!date) return null;
  return { start: startOfDay(date).toISOString(), end: endOfDay(date).toISOString() };
}

function SlotPicker({
  doctorId,
  date,
  selected,
  onSelect,
}: {
  doctorId: string;
  date: string;
  selected: { start: string; end: string } | null;
  onSelect: (slot: { start: string; end: string } | null) => void;
}) {
  const range = dayRange(date);
  const query = useQuery({
    queryKey: ['slots', doctorId, date],
    queryFn: () =>
      appointmentsApi.availableSlots({
        doctorId,
        start: range?.start ?? '',
        end: range?.end ?? '',
      }),
    enabled: doctorId !== '' && range !== null,
  });

  if (!doctorId) {
    return <p className="text-sm text-slate-500">Select a doctor to view available times.</p>;
  }
  if (query.isPending) return <p className="text-sm text-slate-500">Loading available times…</p>;
  if (query.isError) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!query.data || query.data.slots.length === 0) {
    return <p className="text-sm text-slate-500">No available slots on this date.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {query.data.slots.map((slot) => {
        const active = selected?.start === slot.start;
        return (
          <button
            key={slot.start}
            type="button"
            onClick={() => onSelect(slot)}
            className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
              active
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'
            }`}
          >
            {formatTime(slot.start)}
          </button>
        );
      })}
    </div>
  );
}

function BookingForm({
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  error: unknown;
  onSubmit: (input: BookAppointmentInput) => void;
  onCancel: () => void;
}) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [date, setDate] = useState(toDateInput(tomorrow));
  const [doctorId, setDoctorId] = useState('');
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const range = dayRange(date);
  const doctors = useQuery({
    queryKey: ['booking-doctors', date],
    queryFn: () =>
      appointmentsApi.availableDoctors({
        start: range?.start ?? '',
        end: range?.end ?? '',
        page: 1,
        pageSize: 100,
      }),
    enabled: range !== null,
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!patient) {
      setMessage('Select a patient.');
      return;
    }
    if (!doctorId || !slot) {
      setMessage('Select a doctor and an available time.');
      return;
    }
    onSubmit({
      patientId: patient.id,
      doctorId,
      scheduledStart: slot.start,
      scheduledEnd: slot.end,
      reason: reason.trim() || undefined,
    });
  }

  return (
    <form className="space-y-6" noValidate onSubmit={submit}>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Patient</h3>
        <PatientPicker selected={patient} onSelect={setPatient} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Appointment</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required>
            <Input
              type="date"
              min={toDateInput(new Date())}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setDoctorId('');
                setSlot(null);
              }}
            />
          </Field>
          <Field label="Reason for visit">
            <Input value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>
        <Field label="Doctor" required>
          <Select
            value={doctorId}
            onChange={(event) => {
              setDoctorId(event.target.value);
              setSlot(null);
            }}
          >
            <option value="">Select a doctor</option>
            {(doctors.data?.doctors ?? []).map((doctor: AvailableDoctor) => (
              <option key={doctor.id} value={doctor.id}>
                Dr. {doctor.firstName} {doctor.lastName} · {doctor.specialization} ({doctor.availableSlotCount} slots)
              </option>
            ))}
          </Select>
        </Field>
        {doctors.isPending ? (
          <p className="text-sm text-slate-500">Loading doctor availability…</p>
        ) : doctors.data && doctors.data.doctors.length === 0 ? (
          <p className="text-sm text-slate-500">No doctors have availability on this date.</p>
        ) : null}
        <Field label="Available time" required>
          <SlotPicker doctorId={doctorId} date={date} selected={slot} onSelect={setSlot} />
        </Field>
      </section>

      {message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
      <FormError error={error} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Book appointment
        </Button>
      </div>
    </form>
  );
}

function RescheduleForm({
  appointment,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  appointment: Appointment;
  pending: boolean;
  error: unknown;
  onSubmit: (input: { scheduledStart: string; scheduledEnd: string; reason?: string }) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(toDateInput(new Date(appointment.scheduledStart)));
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!slot) {
      setMessage('Select a new appointment time.');
      return;
    }
    onSubmit({
      scheduledStart: slot.start,
      scheduledEnd: slot.end,
      reason: reason.trim() || undefined,
    });
  }

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">
          {appointment.patient.firstName} {appointment.patient.lastName}
        </p>
        <p className="text-xs text-slate-500">
          Currently {formatDate(appointment.scheduledStart)}, {formatTimeRange(appointment.scheduledStart, appointment.scheduledEnd)}
        </p>
      </div>
      <Field label="New date" required>
        <Input
          type="date"
          min={toDateInput(new Date())}
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setSlot(null);
          }}
        />
      </Field>
      <Field label="Available time" required>
        <SlotPicker doctorId={appointment.doctorId} date={date} selected={slot} onSelect={setSlot} />
      </Field>
      <Field label="Reason for change">
        <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      {message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
      <FormError error={error} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Reschedule
        </Button>
      </div>
    </form>
  );
}

const statusActions: Partial<Record<AppointmentStatus, Array<{ status: AppointmentStatus; label: string }>>> = {
  SCHEDULED: [
    { status: 'CONFIRMED', label: 'Confirm' },
    { status: 'NO_SHOW', label: 'Mark no-show' },
  ],
  CONFIRMED: [
    { status: 'CHECKED_IN', label: 'Check in' },
    { status: 'NO_SHOW', label: 'Mark no-show' },
  ],
  CHECKED_IN: [
    { status: 'IN_PROGRESS', label: 'Start consultation' },
    { status: 'NO_SHOW', label: 'Mark no-show' },
  ],
  IN_PROGRESS: [{ status: 'COMPLETED', label: 'Complete' }],
};

export function AppointmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FRONT_DESK';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [booking, setBooking] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [formError, setFormError] = useState<unknown>(null);
  const debouncedSearch = useDebouncedValue(search);

  const fromRange = from ? dayRange(from) : null;
  const toRange = to ? dayRange(to) : null;

  const query = useQuery({
    queryKey: ['appointments', { search: debouncedSearch, status, from, to, page }],
    queryFn: () =>
      appointmentsApi.list({
        page,
        pageSize: 20,
        search: debouncedSearch || undefined,
        status: (status || undefined) as AppointmentStatus | undefined,
        from: fromRange?.start,
        to: toRange?.end,
      }),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createMutation = useMutation({
    mutationFn: (input: BookAppointmentInput) => appointmentsApi.book(input),
    onSuccess: (appointment) => {
      toast({
        title: 'Appointment booked',
        description: `${appointment.patient.firstName} ${appointment.patient.lastName} on ${formatDate(appointment.scheduledStart)} at ${formatTime(appointment.scheduledStart)}.`,
      });
      setBooking(false);
      setFormError(null);
      refresh();
    },
    onError: (error) => setFormError(error),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { scheduledStart: string; scheduledEnd: string; reason?: string } }) =>
      appointmentsApi.reschedule(id, input),
    onSuccess: (appointment) => {
      toast({ title: 'Appointment rescheduled', description: formatDateTime(appointment.scheduledStart) });
      setRescheduling(null);
      setSelected(null);
      setFormError(null);
      refresh();
    },
    onError: (error) => setFormError(error),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status: nextStatus }: { id: string; status: AppointmentStatus }) =>
      appointmentsApi.setStatus(id, nextStatus),
    onSuccess: (appointment) => {
      toast({ title: 'Appointment updated', description: humanize(appointment.status) });
      setSelected(appointment);
      refresh();
    },
    onError: (error) =>
      toast({ title: 'Could not update appointment', description: errorMessage(error), tone: 'error' }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => appointmentsApi.cancel(id, reason),
    onSuccess: (appointment) => {
      toast({ title: 'Appointment cancelled', description: `${formatDate(appointment.scheduledStart)} · ${appointment.appointmentNumber}` });
      setCancelling(null);
      setCancelReason('');
      setSelected(null);
      refresh();
    },
    onError: (error) =>
      toast({ title: 'Could not cancel appointment', description: errorMessage(error), tone: 'error' }),
  });

  const rows = query.data?.appointments ?? [];
  const pagination = query.data?.pagination;
  const selectedActions = selected ? statusActions[selected.status] ?? [] : [];

  const columns: Array<Column<Appointment>> = [
    {
      key: 'patient',
      header: 'Patient',
      render: (appointment) => (
        <div className="flex items-center gap-3">
          <Avatar firstName={appointment.patient.firstName} lastName={appointment.patient.lastName} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">
              {appointment.patient.firstName} {appointment.patient.lastName}
            </p>
            <p className="text-xs text-slate-500">{appointment.patient.patientNumber}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (appointment) => (
        <div>
          <p className="text-sm font-medium text-slate-700">{formatDate(appointment.scheduledStart)}</p>
          <p className="text-xs text-slate-500">
            {formatTimeRange(appointment.scheduledStart, appointment.scheduledEnd)}
          </p>
        </div>
      ),
    },
    {
      key: 'doctor',
      header: 'Doctor',
      render: (appointment) => (
        <div>
          <p className="text-sm text-slate-700">
            Dr. {appointment.doctor.firstName} {appointment.doctor.lastName}
          </p>
          <p className="text-xs text-slate-500">
            {appointment.doctor.specialization} · {appointment.doctor.department.name}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (appointment) => (
        <Badge tone={statusTone(appointment.status)} dot>
          {humanize(appointment.status)}
        </Badge>
      ),
    },
    {
      key: 'number',
      header: 'Reference',
      render: (appointment) => (
        <span className="whitespace-nowrap text-xs font-medium text-slate-500">
          {appointment.appointmentNumber}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (appointment) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(appointment);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={canManage ? 'Front desk operations' : 'Clinical schedule'}
        title="Appointments"
        description={
          canManage
            ? 'Book, confirm and track patient appointments across the hospital.'
            : 'Review the appointments assigned to you and their current status.'
        }
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setFormError(null);
                setBooking(true);
              }}
            >
              Book appointment
            </Button>
          ) : null
        }
      />

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              className="sm:max-w-xs"
              placeholder="Search patient, doctor, reference"
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
              {appointmentStatuses.map((item) => (
                <option key={item} value={item}>
                  {humanize(item)}
                </option>
              ))}
            </Select>
            <Input
              className="sm:w-40"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              aria-label="From date"
            />
            <Input
              className="sm:w-40"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              aria-label="To date"
            />
            {from || to || status || search ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setFrom('');
                  setTo('');
                  setPage(1);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            {pagination ? `${pagination.total} appointments` : 'Loading…'}
          </p>
        </div>

        {query.isError ? (
          <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(appointment) => appointment.id}
              loading={query.isPending}
              onRowClick={(appointment) => setSelected(appointment)}
              empty={
                <EmptyState
                  title="No appointments found"
                  description={canManage ? 'Adjust the filters or book a new appointment.' : 'Nothing matches the selected filters.'}
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
        open={booking}
        onClose={() => {
          setBooking(false);
          setFormError(null);
        }}
        title="Book an appointment"
        description="Search for the patient, select a doctor and choose one of the available times."
        size="lg"
      >
        {booking ? (
          <BookingForm
            pending={createMutation.isPending}
            error={formError}
            onSubmit={(input) => createMutation.mutate(input)}
            onCancel={() => {
              setBooking(false);
              setFormError(null);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? selected.appointmentNumber : 'Appointment'}
        description={selected ? `${formatDate(selected.scheduledStart)} · ${formatTimeRange(selected.scheduledStart, selected.scheduledEnd)}` : undefined}
        size="lg"
        footer={
          selected ? (
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              {canManage && selectedActions.map((action) => (
                <Button
                  key={action.status}
                  variant={action.status === 'NO_SHOW' ? 'outline' : 'primary'}
                  loading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ id: selected.id, status: action.status })}
                >
                  {action.label}
                </Button>
              ))}
              {canManage && (selected.status === 'SCHEDULED' || selected.status === 'CONFIRMED') ? (
                <>
                  <Button variant="outline" onClick={() => {
                    setFormError(null);
                    setRescheduling(selected);
                    setSelected(null);
                  }}>
                    Reschedule
                  </Button>
                  <Button variant="danger" onClick={() => {
                    setCancelReason('');
                    setCancelling(selected);
                    setSelected(null);
                  }}>
                    Cancel appointment
                  </Button>
                </>
              ) : null}
              <Button variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(selected.status)} dot>
                {humanize(selected.status)}
              </Badge>
              <span className="text-sm text-slate-500">{selected.appointmentNumber}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</p>
                <p className="mt-2 font-semibold text-slate-900">
                  {selected.patient.firstName} {selected.patient.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {selected.patient.patientNumber} · {selected.patient.phone ?? 'No phone'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Doctor</p>
                <p className="mt-2 font-semibold text-slate-900">
                  Dr. {selected.doctor.firstName} {selected.doctor.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {selected.doctor.specialization} · {selected.doctor.department.name}
                </p>
              </div>
            </div>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="Scheduled" value={`${formatDate(selected.scheduledStart)}, ${formatTimeRange(selected.scheduledStart, selected.scheduledEnd)}`} />
              <DetailRow label="Reason" value={selected.reason ?? '—'} />
              <DetailRow label="Notes" value={selected.notes ?? '—'} />
              <DetailRow label="Booked" value={formatDateTime(selected.createdAt)} />
              {selected.cancellationReason ? (
                <DetailRow label="Cancellation reason" value={selected.cancellationReason} />
              ) : null}
            </dl>
            {!canManage ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Appointment changes are handled by the front desk.
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={rescheduling !== null}
        onClose={() => {
          setRescheduling(null);
          setFormError(null);
        }}
        title="Reschedule appointment"
        description="Choose a new available time. The patient and doctor stay the same."
        size="lg"
      >
        {rescheduling ? (
          <RescheduleForm
            key={rescheduling.id}
            appointment={rescheduling}
            pending={rescheduleMutation.isPending}
            error={formError}
            onSubmit={(input) => rescheduleMutation.mutate({ id: rescheduling.id, input })}
            onCancel={() => {
              setRescheduling(null);
              setFormError(null);
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel appointment?"
        description={`${cancelling ? `${cancelling.patient.firstName} ${cancelling.patient.lastName} · ${formatDate(cancelling.scheduledStart)}` : ''}. This cannot be undone.`}
        confirmLabel="Cancel appointment"
        loading={cancelMutation.isPending}
        onConfirm={() => {
          if (!cancelling) return;
          if (cancelReason.trim().length < 3) {
            toast({ title: 'Please provide a cancellation reason', tone: 'info' });
            return;
          }
          cancelMutation.mutate({ id: cancelling.id, reason: cancelReason.trim() });
        }}
        onClose={() => {
          if (!cancelMutation.isPending) {
            setCancelling(null);
            setCancelReason('');
          }
        }}
      >
        <Field label="Cancellation reason" required>
          <Textarea
            rows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Explain why this appointment is being cancelled."
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
