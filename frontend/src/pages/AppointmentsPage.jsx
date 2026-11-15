import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, CalendarX2, Clock3, Search, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
} from '../components/ui';
import { APPOINTMENT_STATUSES, APPOINTMENT_TRANSITIONS, APPOINTMENT_TYPES } from '../lib/constants';
import { doctorName, formatDate, formatTime, fullName, titleCase, todayKey } from '../lib/utils';

function SlotPicker({ slots, value, onChange, loading }) {
  if (loading) return <p className="py-4 text-center text-sm text-slate-400">Checking availability…</p>;
  if (!slots.length) return <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">No slots available for this date.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {slots.map((slot) => (
        <button
          key={slot.startTime}
          type="button"
          disabled={!slot.available}
          onClick={() => onChange(slot.startTime)}
          className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
            value === slot.startTime
              ? 'border-teal-600 bg-teal-600 text-white'
              : slot.available
                ? 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50'
                : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through'
          }`}
        >
          {formatTime(slot.startTime)}
        </button>
      ))}
    </div>
  );
}

export default function AppointmentsPage() {
  const { user } = useAuth();
  const canBook = user.role !== 'DOCTOR';
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [statusSaving, setStatusSaving] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/appointments', { params: { page, limit: 10, search, status, date } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, status, date]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!createOpen || !canBook) return;
    Promise.all([api.get('/patients', { params: { limit: 100, status: 'ACTIVE' } }), api.get('/doctors', { params: { limit: 100, status: 'ACTIVE' } })])
      .then(([patientResponse, doctorResponse]) => {
        setPatients(patientResponse.data.data || []);
        setDoctors(doctorResponse.data.data || []);
      })
      .catch((err) => toast.error(getErrorMessage(err)));
  }, [createOpen, canBook]);

  const changeStatus = async (appointment, nextStatus) => {
    if (!nextStatus) return;
    setStatusSaving(appointment._id);
    try {
      await api.patch(`/appointments/${appointment._id}/status`, { status: nextStatus });
      toast.success(`Appointment marked ${titleCase(nextStatus)}`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setStatusSaving(null);
    }
  };

  const cancelAppointment = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.patch(`/appointments/${cancelTarget._id}/cancel`, { reason: 'Cancelled from appointment desk' });
      toast.success('Appointment cancelled');
      setCancelTarget(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const nextStatuses = (appointment) => {
    const allowed = APPOINTMENT_TRANSITIONS[appointment.status] || [];
    return user.role === 'RECEPTIONIST' ? allowed.filter((item) => !['IN_PROGRESS', 'COMPLETED'].includes(item)) : allowed;
  };

  return (
    <div>
      <PageHeader
        title="Appointments"
        description={user.role === 'DOCTOR' ? 'Your assigned appointment schedule.' : 'Book, reschedule and manage patient visits across departments.'}
        actions={canBook ? <Button onClick={() => setCreateOpen(true)}><CalendarPlus size={16} /> New appointment</Button> : null}
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search appointment, patient or doctor…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {APPOINTMENT_STATUSES.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
        </Select>
        <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
      </div>

      {loading ? <Spinner /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No appointments found"
          description="Try another filter or book a new appointment."
          icon={CalendarX2}
          action={canBook ? <Button onClick={() => setCreateOpen(true)}><CalendarPlus size={16} /> New appointment</Button> : null}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Appointment</Th>
              <Th>Patient</Th>
              <Th>Doctor</Th>
              <Th>Schedule</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((appointment) => {
              const options = nextStatuses(appointment);
              const canReschedule = ['BOOKED', 'CONFIRMED', 'CHECKED_IN'].includes(appointment.status);
              const canCancel = !['COMPLETED', 'CANCELLED'].includes(appointment.status);
              return (
                <Tr key={appointment._id}>
                  <Td><Badge tone="neutral">{appointment.appointmentNumber}</Badge></Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar firstName={appointment.patient?.firstName} lastName={appointment.patient?.lastName} size="sm" />
                      <div>
                        <p className="font-semibold text-slate-800">{fullName(appointment.patient)}</p>
                        <p className="text-[11px] text-slate-400">{appointment.patient?.patientId}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <p className="font-medium text-slate-700">{doctorName(appointment.doctor)}</p>
                    <p className="text-[11px] text-slate-400">{appointment.doctor?.specialization}</p>
                  </Td>
                  <Td>
                    <p>{formatDate(appointment.date)}</p>
                    <p className="text-[11px] text-slate-400">{formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}</p>
                  </Td>
                  <Td>{titleCase(appointment.appointmentType)}</Td>
                  <Td><StatusBadge status={appointment.status} /></Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canReschedule ? <Button size="sm" variant="secondary" onClick={() => setRescheduleTarget(appointment)}>Reschedule</Button> : null}
                      {options.length ? (
                        <Select
                          className="h-8 w-36 py-1 text-xs"
                          value=""
                          disabled={statusSaving === appointment._id}
                          onChange={(e) => changeStatus(appointment, e.target.value)}
                        >
                          <option value="">Update status…</option>
                          {options.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
                        </Select>
                      ) : null}
                      {canCancel ? (
                        <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setCancelTarget(appointment)}>Cancel</Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}

      <CreateAppointmentModal open={createOpen} onClose={() => setCreateOpen(false)} patients={patients} doctors={doctors} onCreated={load} />
      <RescheduleModal appointment={rescheduleTarget} onClose={() => setRescheduleTarget(null)} onSaved={load} />
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={cancelAppointment}
        loading={cancelling}
        title="Cancel appointment?"
        confirmLabel="Cancel appointment"
        description={cancelTarget ? `This will cancel ${cancelTarget.appointmentNumber} for ${fullName(cancelTarget.patient)} and release the time slot.` : ''}
      />
    </div>
  );
}

function CreateAppointmentModal({ open, onClose, patients, doctors, onCreated }) {
  const [form, setForm] = useState({ patient: '', doctor: '', date: todayKey(), startTime: '', appointmentType: 'CONSULTATION', reason: '', notes: '' });
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ patient: '', doctor: '', date: todayKey(), startTime: '', appointmentType: 'CONSULTATION', reason: '', notes: '' });
      setSlots([]);
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open || !form.doctor || !form.date) { setSlots([]); return undefined; }
    let active = true;
    setSlotsLoading(true);
    setForm((current) => ({ ...current, startTime: '' }));
    api.get(`/doctors/${form.doctor}/availability`, { params: { date: form.date } })
      .then((response) => { if (active) setSlots(response.data.data.slots || []); })
      .catch((err) => { if (active) toast.error(getErrorMessage(err)); })
      .finally(() => { if (active) setSlotsLoading(false); });
    return () => { active = false; };
  }, [open, form.doctor, form.date]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.startTime) { setError('Choose an available time slot.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/appointments', form);
      toast.success('Appointment booked');
      onCreated?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book appointment"
      description="Select a patient, doctor and an available consultation slot."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="appointment-form" loading={saving}><CalendarPlus size={16} /> Book appointment</Button>
        </>
      }
    >
      <form id="appointment-form" onSubmit={submit} className="space-y-5">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Patient" required>
            <Select required value={form.patient} onChange={(e) => set('patient', e.target.value)}>
              <option value="">Select patient…</option>
              {patients.map((patient) => <option key={patient._id} value={patient._id}>{patient.patientId} · {fullName(patient)}</option>)}
            </Select>
          </Field>
          <Field label="Doctor" required>
            <Select required value={form.doctor} onChange={(e) => set('doctor', e.target.value)}>
              <option value="">Select doctor…</option>
              {doctors.map((doctor) => <option key={doctor._id} value={doctor._id}>{doctorName(doctor)} · {doctor.specialization}</option>)}
            </Select>
          </Field>
          <Field label="Date" required><Input type="date" min={todayKey()} required value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Visit type">
            <Select value={form.appointmentType} onChange={(e) => set('appointmentType', e.target.value)}>
              {APPOINTMENT_TYPES.map((type) => <option key={type} value={type}>{titleCase(type)}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Available slots" required hint={form.doctor && form.date ? 'Unavailable slots are crossed out.' : 'Choose a doctor and date to load slots.'}>
          <SlotPicker slots={slots} value={form.startTime} onChange={(value) => set('startTime', value)} loading={slotsLoading} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reason for visit"><Input value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Routine consultation" /></Field>
          <Field label="Internal notes"><Input value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        </div>
      </form>
    </Modal>
  );
}

function RescheduleModal({ appointment, onClose, onSaved }) {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (appointment) {
      setDate(appointment.date);
      setStartTime('');
      setSlots([]);
      setError('');
    }
  }, [appointment]);

  useEffect(() => {
    if (!appointment || !date) return undefined;
    let active = true;
    setSlotsLoading(true);
    setStartTime('');
    api.get(`/doctors/${appointment.doctor?._id}/availability`, { params: { date } })
      .then((response) => { if (active) setSlots(response.data.data.slots || []); })
      .catch((err) => { if (active) toast.error(getErrorMessage(err)); })
      .finally(() => { if (active) setSlotsLoading(false); });
    return () => { active = false; };
  }, [appointment, date]);

  const submit = async (event) => {
    event.preventDefault();
    if (!startTime) { setError('Choose a new time slot.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/appointments/${appointment._id}/reschedule`, { date, startTime });
      toast.success('Appointment rescheduled');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(appointment)}
      onClose={onClose}
      title="Reschedule appointment"
      description={appointment ? `${appointment.appointmentNumber} · ${fullName(appointment.patient)}` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="reschedule-form" loading={saving}><Clock3 size={16} /> Save new time</Button>
        </>
      }
    >
      <form id="reschedule-form" onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <Field label="Doctor">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <Stethoscope size={15} className="text-teal-600" /> {doctorName(appointment?.doctor)}
          </div>
        </Field>
        <Field label="New date" required><Input type="date" min={todayKey()} required value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Available slots" required>
          <SlotPicker slots={slots} value={startTime} onChange={setStartTime} loading={slotsLoading} />
        </Field>
        <Field label="Reason for reschedule"><Textarea rows={2} placeholder="Optional" /></Field>
      </form>
    </Modal>
  );
}
