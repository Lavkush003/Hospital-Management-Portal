import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
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
import { DAY_NAMES } from '../lib/constants';
import { doctorName, formatCurrency } from '../lib/utils';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  department: '',
  specialization: '',
  qualification: '',
  experienceYears: 0,
  consultationFee: 0,
  appointmentDuration: 30,
  workingDays: [1, 2, 3, 4, 5],
  workingHours: { start: '09:00', end: '17:00' },
  bio: '',
  password: '',
  status: 'ACTIVE',
};

export default function DoctorsPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    api.get('/departments', { params: { limit: 100, status: 'ACTIVE' } })
      .then((response) => setDepartments(response.data.data || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/doctors', { params: { page, limit: 10, search, department, status } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, department, status]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (doctor, next) => {
    try {
      await api.patch(`/doctors/${doctor._id}/status`, { status: next });
      toast.success('Doctor status updated');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Doctors"
        description="Clinical roster, specialties, consultation fees and availability."
        actions={isAdmin ? <Button onClick={() => { setSelected(null); setModalOpen(true); }}><Plus size={16} /> Add doctor</Button> : null}
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_220px_180px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, ID, specialty…" className="pl-9" />
        </div>
        <Select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
          <option value="">All departments</option>
          {departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ON_LEAVE">On leave</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
      </div>

      {loading ? <Spinner /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No doctors found" description="Adjust your filters or add a doctor." icon={Stethoscope} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Doctor</Th>
              <Th>Department</Th>
              <Th>Specialty</Th>
              <Th>Experience</Th>
              <Th>Consultation fee</Th>
              <Th>Status</Th>
              {isAdmin ? <Th className="text-right">Actions</Th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((doctor) => (
              <Tr key={doctor._id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar firstName={doctor.firstName} lastName={doctor.lastName} size="sm" />
                    <div>
                      <p className="font-semibold text-slate-800">{doctorName(doctor)}</p>
                      <p className="text-[11px] text-slate-400">{doctor.doctorId} · {doctor.email}</p>
                    </div>
                  </div>
                </Td>
                <Td><Badge tone="info">{doctor.department?.name || '—'}</Badge></Td>
                <Td>{doctor.specialization}</Td>
                <Td>{doctor.experienceYears} yrs</Td>
                <Td className="font-semibold text-slate-800">{formatCurrency(doctor.consultationFee)}</Td>
                <Td><StatusBadge status={doctor.status} /></Td>
                {isAdmin ? (
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Select className="h-8 w-32 py-1 text-xs" value={doctor.status} onChange={(e) => changeStatus(doctor, e.target.value)}>
                        <option value="ACTIVE">Active</option>
                        <option value="ON_LEAVE">On leave</option>
                        <option value="INACTIVE">Inactive</option>
                      </Select>
                      <IconButton label="Edit doctor" onClick={() => { setSelected(doctor); setModalOpen(true); }}><Pencil size={15} /></IconButton>
                    </div>
                  </Td>
                ) : null}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}

      <DoctorFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        doctor={selected}
        departments={departments}
        onSaved={load}
      />
    </div>
  );
}

function DoctorFormModal({ open, onClose, doctor, departments, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (doctor) {
      setForm({
        firstName: doctor.firstName || '',
        lastName: doctor.lastName || '',
        email: doctor.email || '',
        phone: doctor.phone || '',
        department: doctor.department?._id || doctor.department || '',
        specialization: doctor.specialization || '',
        qualification: doctor.qualification || '',
        experienceYears: doctor.experienceYears || 0,
        consultationFee: doctor.consultationFee || 0,
        appointmentDuration: doctor.appointmentDuration || 30,
        workingDays: doctor.workingDays || [1, 2, 3, 4, 5],
        workingHours: doctor.workingHours || { start: '09:00', end: '17:00' },
        bio: doctor.bio || '',
        password: '',
        status: doctor.status || 'ACTIVE',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, doctor]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleDay = (day) => setForm((current) => ({
    ...current,
    workingDays: current.workingDays.includes(day) ? current.workingDays.filter((item) => item !== day) : [...current.workingDays, day],
  }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    if (doctor) delete payload.password;
    try {
      if (doctor) await api.put(`/doctors/${doctor._id}`, payload);
      else await api.post('/doctors', payload);
      toast.success(doctor ? 'Doctor updated' : 'Doctor added');
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
      title={doctor ? 'Edit doctor' : 'Add doctor'}
      description={doctor ? doctor.doctorId : 'Create a clinical profile and login account.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="doctor-form" loading={saving}>{doctor ? 'Save changes' : 'Add doctor'}</Button>
        </>
      }
    >
      <form id="doctor-form" onSubmit={submit} className="space-y-5">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required><Input required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
          <Field label="Last name" required><Input required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
          <Field label="Email" required><Input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Department" required>
            <Select required value={form.department} onChange={(e) => set('department', e.target.value)}>
              <option value="">Select department…</option>
              {departments.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Specialization" required><Input required value={form.specialization} onChange={(e) => set('specialization', e.target.value)} placeholder="Cardiology" /></Field>
          <Field label="Qualification" required><Input required value={form.qualification} onChange={(e) => set('qualification', e.target.value)} placeholder="MD, FACC" /></Field>
          <Field label="Experience (years)"><Input type="number" min="0" max="70" value={form.experienceYears} onChange={(e) => set('experienceYears', e.target.value)} /></Field>
          <Field label="Consultation fee"><Input type="number" min="0" step="0.01" value={form.consultationFee} onChange={(e) => set('consultationFee', e.target.value)} /></Field>
          <Field label="Slot duration (minutes)"><Input type="number" min="10" max="120" step="5" value={form.appointmentDuration} onChange={(e) => set('appointmentDuration', e.target.value)} /></Field>
          <Field label="Shift start"><Input type="time" value={form.workingHours.start} onChange={(e) => set('workingHours', { ...form.workingHours, start: e.target.value })} /></Field>
          <Field label="Shift end"><Input type="time" value={form.workingHours.end} onChange={(e) => set('workingHours', { ...form.workingHours, end: e.target.value })} /></Field>
        </div>

        <Field label="Working days" required>
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.map((day, index) => (
              <button
                type="button"
                key={day}
                onClick={() => toggleDay(index)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  form.workingDays.includes(index) ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Bio"><Textarea rows={3} value={form.bio} onChange={(e) => set('bio', e.target.value)} /></Field>
        {!doctor ? <Field label="Initial password" hint="Optional. Defaults to the server seed password."><Input type="password" minLength="8" value={form.password} onChange={(e) => set('password', e.target.value)} /></Field> : null}
      </form>
    </Modal>
  );
}
