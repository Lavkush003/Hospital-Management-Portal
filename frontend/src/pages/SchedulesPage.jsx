import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api, { getErrorMessage } from '../lib/api';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { DAY_NAMES } from '../lib/constants';
import { doctorName, formatTime } from '../lib/utils';

const emptyForm = { doctor: '', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', slotDuration: 30, room: '', isActive: true };

export default function SchedulesPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [doctor, setDoctor] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get('/doctors', { params: { limit: 100 } })
      .then((response) => setDoctors(response.data.data || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/schedules', { params: { page, limit: 20, doctor, dayOfWeek } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, doctor, dayOfWeek]);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/schedules/${deleteTarget._id}`);
      toast.success('Schedule deleted');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Doctor schedules"
        description="Recurring weekly availability blocks used for appointment slot generation."
        actions={<Button onClick={() => { setSelected(null); setModalOpen(true); }}><Plus size={16} /> Add schedule block</Button>}
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <Select value={doctor} onChange={(e) => { setDoctor(e.target.value); setPage(1); }}>
          <option value="">All doctors</option>
          {doctors.map((item) => <option key={item._id} value={item._id}>{doctorName(item)}</option>)}
        </Select>
        <Select value={dayOfWeek} onChange={(e) => { setDayOfWeek(e.target.value); setPage(1); }}>
          <option value="">All days</option>
          {DAY_NAMES.map((day, index) => <option key={day} value={index}>{day}</option>)}
        </Select>
      </div>

      {loading ? <Spinner /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No schedule blocks" description="Add a recurring availability block to begin booking appointments." icon={CalendarClock} />
      ) : (
        <Table>
          <thead><tr><Th>Doctor</Th><Th>Day</Th><Th>Hours</Th><Th>Slot duration</Th><Th>Room</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody>
            {items.map((schedule) => (
              <Tr key={schedule._id}>
                <Td>
                  <p className="font-semibold text-slate-800">{doctorName(schedule.doctor)}</p>
                  <p className="text-[11px] text-slate-400">{schedule.doctor?.department?.name || schedule.doctor?.specialization}</p>
                </Td>
                <Td><Badge tone="info">{DAY_NAMES[schedule.dayOfWeek]}</Badge></Td>
                <Td>{formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}</Td>
                <Td>{schedule.slotDuration} min</Td>
                <Td>{schedule.room || '—'}</Td>
                <Td><Badge tone={schedule.isActive ? 'success' : 'neutral'}>{schedule.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge></Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton label="Edit schedule" onClick={() => { setSelected(schedule); setModalOpen(true); }}><Pencil size={15} /></IconButton>
                    <IconButton label="Delete schedule" className="text-rose-500 hover:bg-rose-50 hover:text-rose-700" onClick={() => setDeleteTarget(schedule)}><Trash2 size={15} /></IconButton>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}

      <ScheduleFormModal open={modalOpen} onClose={() => { setModalOpen(false); setSelected(null); }} schedule={selected} doctors={doctors} onSaved={load} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={deleting}
        title="Delete schedule block?"
        confirmLabel="Delete schedule"
        description={deleteTarget ? `Remove ${DAY_NAMES[deleteTarget.dayOfWeek]} ${formatTime(deleteTarget.startTime)}–${formatTime(deleteTarget.endTime)} availability for ${doctorName(deleteTarget.doctor)}?` : ''}
      />
    </div>
  );
}

function ScheduleFormModal({ open, onClose, schedule, doctors, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(schedule ? {
      doctor: schedule.doctor?._id || schedule.doctor || '',
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      slotDuration: schedule.slotDuration || 30,
      room: schedule.room || '',
      isActive: schedule.isActive !== false,
    } : emptyForm);
  }, [open, schedule]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (schedule) await api.put(`/schedules/${schedule._id}`, { ...form, doctor: undefined });
      else await api.post('/schedules', form);
      toast.success(schedule ? 'Schedule updated' : 'Schedule created');
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
      open={open}
      onClose={onClose}
      title={schedule ? 'Edit schedule block' : 'Add schedule block'}
      description="Schedule blocks generate bookable slots automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="schedule-form" loading={saving}>{schedule ? 'Save changes' : 'Create schedule'}</Button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Doctor" required>
            <Select required disabled={Boolean(schedule)} value={form.doctor} onChange={(e) => set('doctor', e.target.value)}>
              <option value="">Select doctor…</option>
              {doctors.map((doctor) => <option key={doctor._id} value={doctor._id}>{doctorName(doctor)}</option>)}
            </Select>
          </Field>
          <Field label="Day of week" required>
            <Select value={form.dayOfWeek} onChange={(e) => set('dayOfWeek', Number(e.target.value))}>
              {DAY_NAMES.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </Select>
          </Field>
          <Field label="Start time" required><Input type="time" required value={form.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>
          <Field label="End time" required><Input type="time" required value={form.endTime} onChange={(e) => set('endTime', e.target.value)} /></Field>
          <Field label="Slot duration (minutes)"><Input type="number" min="10" max="120" step="5" value={form.slotDuration} onChange={(e) => set('slotDuration', e.target.value)} /></Field>
          <Field label="Room"><Input value={form.room} onChange={(e) => set('room', e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600" />
          Active availability block
        </label>
      </form>
    </Modal>
  );
}
