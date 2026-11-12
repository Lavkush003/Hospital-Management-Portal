import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Doctor, DoctorLeave, DoctorSchedule, DoctorUnavailability } from '@/types/api';
import {
  doctorsApi,
  schedulesApi,
  type LeaveInput,
  type ScheduleBreakInput,
  type ScheduleInput,
} from '@/services/hms';
import { errorMessage } from '@/services/api';
import { useToast } from '@/components/feedback/toast-context';
import { formatDateTime, formatTimeRange, humanize } from '@/utils/format';
import { fromDateTimeLocal, toDateTimeLocal } from '@/utils/date';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Checkbox, Field, Input, Select } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/States';
import { FormError } from '@/components/feedback/FormBits';

const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

interface ScheduleValues {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: string;
  room: string;
  isActive: boolean;
  breakTimes: ScheduleBreakInput[];
}

function scheduleValues(schedule?: DoctorSchedule | null): ScheduleValues {
  return {
    dayOfWeek: schedule?.dayOfWeek ?? 'MONDAY',
    startTime: schedule?.startTime ?? '09:00',
    endTime: schedule?.endTime ?? '17:00',
    slotDurationMinutes: String(schedule?.slotDurationMinutes ?? 30),
    room: schedule?.room ?? '',
    isActive: schedule?.isActive ?? true,
    breakTimes: schedule?.breaks.map((item) => ({ startTime: item.startTime, endTime: item.endTime })) ?? [],
  };
}

function ScheduleForm({
  schedule,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  schedule?: DoctorSchedule | null;
  pending: boolean;
  error: unknown;
  onSubmit: (input: ScheduleInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ScheduleValues>(() => scheduleValues(schedule));
  const [message, setMessage] = useState('');

  function set<K extends keyof ScheduleValues>(key: K, value: ScheduleValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateBreak(index: number, key: keyof ScheduleBreakInput, value: string) {
    setValues((current) => ({
      ...current,
      breakTimes: current.breakTimes.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!values.startTime || !values.endTime) {
      setMessage('Start and end time are required.');
      return;
    }
    if (values.endTime <= values.startTime) {
      setMessage('End time must be after start time.');
      return;
    }
    const slot = Number(values.slotDurationMinutes);
    if (!Number.isFinite(slot) || slot < 5 || slot > 240) {
      setMessage('Slot duration must be between 5 and 240 minutes.');
      return;
    }
    const breaks = values.breakTimes.filter((item) => item.startTime && item.endTime);
    if (breaks.some((item) => item.endTime <= item.startTime)) {
      setMessage('Each break must end after it starts.');
      return;
    }

    onSubmit({
      dayOfWeek: values.dayOfWeek,
      startTime: values.startTime,
      endTime: values.endTime,
      slotDurationMinutes: slot,
      breakTimes: breaks,
      room: values.room.trim() || undefined,
      isActive: values.isActive,
    });
  }

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Day of week" required>
          <Select value={values.dayOfWeek} onChange={(event) => set('dayOfWeek', event.target.value)}>
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {humanize(day)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Slot duration" required hint="Minutes per appointment.">
          <Input
            type="number"
            min="5"
            max="240"
            value={values.slotDurationMinutes}
            onChange={(event) => set('slotDurationMinutes', event.target.value)}
          />
        </Field>
        <Field label="Start time" required>
          <Input type="time" value={values.startTime} onChange={(event) => set('startTime', event.target.value)} />
        </Field>
        <Field label="End time" required>
          <Input type="time" value={values.endTime} onChange={(event) => set('endTime', event.target.value)} />
        </Field>
        <Field label="Room">
          <Input value={values.room} onChange={(event) => set('room', event.target.value)} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox
            label="Schedule is active"
            checked={values.isActive}
            onChange={(event) => set('isActive', event.target.checked)}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Breaks</h3>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              set('breakTimes', [...values.breakTimes, { startTime: '12:00', endTime: '13:00' }])
            }
          >
            Add break
          </Button>
        </div>
        {values.breakTimes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No breaks configured.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {values.breakTimes.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="time"
                  value={item.startTime}
                  onChange={(event) => updateBreak(index, 'startTime', event.target.value)}
                />
                <span className="text-sm text-slate-400">to</span>
                <Input
                  type="time"
                  value={item.endTime}
                  onChange={(event) => updateBreak(index, 'endTime', event.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    set('breakTimes', values.breakTimes.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

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
          {schedule ? 'Save schedule' : 'Add schedule'}
        </Button>
      </div>
    </form>
  );
}

function TimeOffForm({
  title,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  title: string;
  pending: boolean;
  error: unknown;
  onSubmit: (input: LeaveInput) => void;
  onCancel: () => void;
}) {
  const now = new Date();
  const [startAt, setStartAt] = useState(toDateTimeLocal(now));
  const [endAt, setEndAt] = useState(toDateTimeLocal(new Date(now.getTime() + 60 * 60 * 1000)));
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const start = fromDateTimeLocal(startAt);
    const end = fromDateTimeLocal(endAt);
    if (!start || !end) {
      setMessage('Start and end date/time are required.');
      return;
    }
    if (end <= start) {
      setMessage('End must be after start.');
      return;
    }
    onSubmit({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      reason: reason.trim() || undefined,
    });
  }

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" required>
          <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} />
        </Field>
        <Field label="Ends" required>
          <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} />
        </Field>
      </div>
      <Field label="Reason">
        <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
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
          {title}
        </Button>
      </div>
    </form>
  );
}

type DeleteTarget =
  | { type: 'schedule'; item: DoctorSchedule }
  | { type: 'leave'; item: DoctorLeave }
  | { type: 'unavailability'; item: DoctorUnavailability }
  | null;

export function SchedulesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDoctorId, setDoctorId] = useState('');
  const [scheduleForm, setScheduleForm] = useState<
    { mode: 'create' } | { mode: 'edit'; schedule: DoctorSchedule } | null
  >(null);
  const [timeOff, setTimeOff] = useState<'leave' | 'unavailability' | null>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const doctors = useQuery({
    queryKey: ['doctors', 'options'],
    queryFn: () => doctorsApi.list({ page: 1, pageSize: 100 }),
  });

  const doctorId = selectedDoctorId || doctors.data?.doctors[0]?.id || '';

  const doctor = doctors.data?.doctors.find((item) => item.id === doctorId) ?? null;

  const scheduleQuery = useQuery({
    queryKey: ['schedules', doctorId],
    queryFn: () => schedulesApi.list(doctorId),
    enabled: doctorId !== '',
  });
  const leaveQuery = useQuery({
    queryKey: ['leaves', doctorId],
    queryFn: () => schedulesApi.listLeaves(doctorId, { page: 1, pageSize: 50 }),
    enabled: doctorId !== '',
  });
  const unavailableQuery = useQuery({
    queryKey: ['unavailability', doctorId],
    queryFn: () => schedulesApi.listUnavailability(doctorId, { page: 1, pageSize: 50 }),
    enabled: doctorId !== '',
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['schedules', doctorId] });
    void queryClient.invalidateQueries({ queryKey: ['leaves', doctorId] });
    void queryClient.invalidateQueries({ queryKey: ['unavailability', doctorId] });
    void queryClient.invalidateQueries({ queryKey: ['appointments'] });
  };

  const scheduleCreate = useMutation({
    mutationFn: (input: ScheduleInput) => schedulesApi.create(doctorId, input),
    onSuccess: () => {
      toast({ title: 'Schedule added' });
      setScheduleForm(null);
      setFormError(null);
      refresh();
    },
    onError: (error) => setFormError(error),
  });

  const scheduleUpdate = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ScheduleInput }) =>
      schedulesApi.update(doctorId, id, input),
    onSuccess: () => {
      toast({ title: 'Schedule updated' });
      setScheduleForm(null);
      setFormError(null);
      refresh();
    },
    onError: (error) => setFormError(error),
  });

  const leaveCreate = useMutation({
    mutationFn: (input: LeaveInput) => schedulesApi.createLeave(doctorId, input),
    onSuccess: () => {
      toast({ title: 'Leave recorded' });
      setTimeOff(null);
      setFormError(null);
      refresh();
    },
    onError: (error) => setFormError(error),
  });

  const unavailabilityCreate = useMutation({
    mutationFn: (input: LeaveInput) => schedulesApi.createUnavailability(doctorId, input),
    onSuccess: () => {
      toast({ title: 'Unavailability recorded' });
      setTimeOff(null);
      setFormError(null);
      refresh();
    },
    onError: (error) => setFormError(error),
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: NonNullable<DeleteTarget>) => {
      if (target.type === 'schedule') return schedulesApi.remove(doctorId, target.item.id);
      if (target.type === 'leave') return schedulesApi.removeLeave(doctorId, target.item.id);
      return schedulesApi.removeUnavailability(doctorId, target.item.id);
    },
    onSuccess: () => {
      toast({ title: 'Removed successfully' });
      setDeleteTarget(null);
      refresh();
    },
    onError: (error) =>
      toast({ title: 'Could not remove entry', description: errorMessage(error), tone: 'error' }),
  });

  const schedules = scheduleQuery.data?.schedules ?? [];
  const leaves = leaveQuery.data?.leaves ?? [];
  const unavailability = unavailableQuery.data?.unavailability ?? [];
  const timeOffPending = leaveCreate.isPending || unavailabilityCreate.isPending;
  const schedulePending = scheduleCreate.isPending || scheduleUpdate.isPending;

  function deleteLabel(target: NonNullable<DeleteTarget>) {
    if (target.type === 'schedule') {
      return `${humanize(target.item.dayOfWeek)} ${formatTimeRange(target.item.startTime, target.item.endTime)}`;
    }
    return `${formatDateTime(target.item.startAt)} – ${formatDateTime(target.item.endAt)}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Doctor availability"
        title="Schedules & time off"
        description="Maintain weekly clinic sessions, leave and temporary unavailability for each doctor."
        actions={
          doctorId ? (
            <>
              <Button variant="outline" onClick={() => {
                setFormError(null);
                setTimeOff('unavailability');
              }}>
                Add unavailability
              </Button>
              <Button onClick={() => {
                setFormError(null);
                setScheduleForm({ mode: 'create' });
              }}>
                Add schedule
              </Button>
            </>
          ) : null
        }
      />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="schedule-doctor">
              Doctor
            </label>
            <Select id="schedule-doctor" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
              {(doctors.data?.doctors ?? []).map((item: Doctor) => (
                <option key={item.id} value={item.id}>
                  Dr. {item.firstName} {item.lastName} · {item.specialization}
                </option>
              ))}
            </Select>
          </div>
          {doctor ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <p className="font-semibold text-slate-900">
                Dr. {doctor.firstName} {doctor.lastName}
              </p>
              <p className="text-xs text-slate-500">
                {doctor.department?.name ?? 'No department'} · {doctor.employeeCode}
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      {!doctorId ? (
        <Card>
          <EmptyState title="No doctors available" description="Add a doctor before configuring schedules." />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card>
            <CardHeader
              title="Weekly schedule"
              description="Recurring clinic sessions for this doctor."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setFormError(null);
                    setScheduleForm({ mode: 'create' });
                  }}
                >
                  Add
                </Button>
              }
            />
            {schedules.length === 0 ? (
              <EmptyState
                title="No schedule configured"
                description="Add weekly sessions so patients can book appointments."
                className="py-10"
              />
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {[...schedules]
                  .sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek))
                  .map((schedule) => (
                    <li key={schedule.id} className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900">{humanize(schedule.dayOfWeek)}</p>
                            <Badge tone={schedule.isActive ? 'success' : 'neutral'}>
                              {schedule.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {formatTimeRange(schedule.startTime, schedule.endTime)} · {schedule.slotDurationMinutes} min slots
                          </p>
                          <p className="text-xs text-slate-500">
                            {schedule.room ? `Room ${schedule.room}` : 'No room assigned'}
                            {schedule.breaks.length > 0
                              ? ` · Breaks ${schedule.breaks.map((item) => formatTimeRange(item.startTime, item.endTime)).join(', ')}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setFormError(null);
                              setScheduleForm({ mode: 'edit', schedule });
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteTarget({ type: 'schedule', item: schedule })}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Leave"
                description="Full-day or multi-day absence."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFormError(null);
                      setTimeOff('leave');
                    }}
                  >
                    Add leave
                  </Button>
                }
              />
              {leaves.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No leave recorded.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {leaves.map((leave) => (
                    <li key={leave.id} className="flex items-start justify-between gap-2 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {formatDateTime(leave.startAt)}
                        </p>
                        <p className="text-xs text-slate-500">
                          to {formatDateTime(leave.endAt)}
                          {leave.reason ? ` · ${leave.reason}` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteTarget({ type: 'leave', item: leave })}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Unavailability"
                description="Temporary block outside formal leave."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFormError(null);
                      setTimeOff('unavailability');
                    }}
                  >
                    Add block
                  </Button>
                }
              />
              {unavailability.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No temporary blocks.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {unavailability.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-2 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {formatDateTime(item.startAt)}
                        </p>
                        <p className="text-xs text-slate-500">
                          to {formatDateTime(item.endAt)}
                          {item.reason ? ` · ${item.reason}` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteTarget({ type: 'unavailability', item })}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={scheduleForm !== null}
        onClose={() => {
          setScheduleForm(null);
          setFormError(null);
        }}
        title={scheduleForm?.mode === 'edit' ? 'Edit schedule' : 'Add weekly schedule'}
        description={
          scheduleForm?.mode === 'edit'
            ? 'Update the recurring clinic session.'
            : `Create a recurring session for ${doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'the doctor'}.`
        }
        size="lg"
      >
        {scheduleForm ? (
          <ScheduleForm
            key={scheduleForm.mode === 'edit' ? scheduleForm.schedule.id : 'new'}
            schedule={scheduleForm.mode === 'edit' ? scheduleForm.schedule : null}
            pending={schedulePending}
            error={formError}
            onSubmit={(input) => {
              if (scheduleForm.mode === 'edit') {
                scheduleUpdate.mutate({ id: scheduleForm.schedule.id, input });
              } else {
                scheduleCreate.mutate(input);
              }
            }}
            onCancel={() => {
              setScheduleForm(null);
              setFormError(null);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={timeOff !== null}
        onClose={() => {
          setTimeOff(null);
          setFormError(null);
        }}
        title={timeOff === 'leave' ? 'Record leave' : 'Record unavailability'}
        description="This period is excluded from appointment availability."
        size="lg"
      >
        {timeOff ? (
          <TimeOffForm
            key={timeOff}
            title={timeOff === 'leave' ? 'Record leave' : 'Record unavailability'}
            pending={timeOffPending}
            error={formError}
            onSubmit={(input) => {
              if (timeOff === 'leave') leaveCreate.mutate(input);
              else unavailabilityCreate.mutate(input);
            }}
            onCancel={() => {
              setTimeOff(null);
              setFormError(null);
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove entry?"
        description={
          deleteTarget
            ? `${deleteLabel(deleteTarget)} will be removed. Existing appointments are not cancelled automatically.`
            : ''
        }
        confirmLabel="Remove"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
