import { useCallback, useEffect, useState } from 'react';
import { ClipboardPlus, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
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
import { ENCOUNTER_STATUSES, VISIT_TYPES } from '../lib/constants';
import { doctorName, formatDate, formatTime, fullName, titleCase, toInputDate, todayKey } from '../lib/utils';

const emptyForm = {
  patient: '',
  appointment: '',
  encounterDate: todayKey(),
  visitType: 'CONSULTATION',
  chiefComplaint: '',
  clinicalNotes: '',
  vitalSigns: { temperatureC: '', bloodPressure: '', heartRate: '', weightKg: '', heightCm: '', oxygenSaturation: '' },
  treatmentNotes: '',
  followUpDate: '',
  status: 'OPEN',
};

export default function EncountersPage() {
  const { user } = useAuth();
  const canWrite = user.role === 'DOCTOR';
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [doctor, setDoctor] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    api.get('/patients', { params: { limit: 100, status: 'ACTIVE' } })
      .then((response) => setPatients(response.data.data || []))
      .catch(() => {});
    if (user.role === 'ADMIN') {
      api.get('/doctors', { params: { limit: 100 } })
        .then((response) => setDoctors(response.data.data || []))
        .catch(() => {});
    }
  }, [user.role]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/encounters', { params: { page, limit: 10, search, status, doctor } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, status, doctor]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Clinical encounters"
        description="Visit notes, diagnoses, vitals and treatment plans."
        actions={canWrite ? <Button onClick={() => { setSelected(null); setModalOpen(true); }}><Plus size={16} /> New encounter</Button> : null}
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_170px_220px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search encounter ID, patient or complaint…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {ENCOUNTER_STATUSES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
        </Select>
        {user.role === 'ADMIN' ? (
          <Select value={doctor} onChange={(e) => { setDoctor(e.target.value); setPage(1); }}>
            <option value="">All doctors</option>
            {doctors.map((item) => <option key={item._id} value={item._id}>{doctorName(item)}</option>)}
          </Select>
        ) : null}
      </div>

      {loading ? <Spinner /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No encounters found" description="Clinical encounters created during consultations will appear here." icon={ClipboardPlus} />
      ) : (
        <Table>
          <thead><tr><Th>Encounter</Th><Th>Patient</Th><Th>Doctor</Th><Th>Date</Th><Th>Visit type</Th><Th>Chief complaint</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody>
            {items.map((encounter) => (
              <Tr key={encounter._id}>
                <Td><Badge tone="neutral">{encounter.encounterId}</Badge></Td>
                <Td>
                  <p className="font-semibold text-slate-800">{fullName(encounter.patient)}</p>
                  <p className="text-[11px] text-slate-400">{encounter.patient?.patientId}</p>
                </Td>
                <Td>{doctorName(encounter.doctor)}</Td>
                <Td>
                  <p>{formatDate(encounter.encounterDate)}</p>
                  <p className="text-[11px] text-slate-400">{formatTime(encounter.createdAt?.slice(11, 16))}</p>
                </Td>
                <Td><Badge tone="info">{titleCase(encounter.visitType)}</Badge></Td>
                <Td><p className="max-w-xs truncate">{encounter.chiefComplaint}</p></Td>
                <Td><StatusBadge status={encounter.status} /></Td>
                <Td className="text-right">
                  <IconButton label={canWrite ? 'Edit encounter' : 'View encounter'} onClick={() => { setSelected(encounter); setModalOpen(true); }}>
                    {canWrite ? <Pencil size={15} /> : <ClipboardPlus size={15} />}
                  </IconButton>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}

      <EncounterFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        encounter={selected}
        patients={patients}
        canWrite={canWrite}
        onSaved={load}
      />
    </div>
  );
}

function EncounterFormModal({ open, onClose, encounter, patients, canWrite, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [appointments, setAppointments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setAppointments([]);
    if (encounter) {
      setForm({
        patient: encounter.patient?._id || encounter.patient || '',
        appointment: encounter.appointment?._id || encounter.appointment || '',
        encounterDate: toInputDate(encounter.encounterDate),
        visitType: encounter.visitType || 'CONSULTATION',
        chiefComplaint: encounter.chiefComplaint || '',
        clinicalNotes: encounter.clinicalNotes || '',
        vitalSigns: {
          temperatureC: encounter.vitalSigns?.temperatureC ?? '',
          bloodPressure: encounter.vitalSigns?.bloodPressure || '',
          heartRate: encounter.vitalSigns?.heartRate ?? '',
          weightKg: encounter.vitalSigns?.weightKg ?? '',
          heightCm: encounter.vitalSigns?.heightCm ?? '',
          oxygenSaturation: encounter.vitalSigns?.oxygenSaturation ?? '',
        },
        treatmentNotes: encounter.treatmentNotes || '',
        followUpDate: toInputDate(encounter.followUpDate),
        status: encounter.status || 'OPEN',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, encounter]);

  useEffect(() => {
    if (!open || encounter || !form.patient || !canWrite) return;
    api.get('/appointments', { params: { patient: form.patient, limit: 50 } })
      .then((response) => setAppointments(response.data.data || []))
      .catch(() => setAppointments([]));
  }, [open, encounter, form.patient, canWrite]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setVital = (key, value) => setForm((current) => ({ ...current, vitalSigns: { ...current.vitalSigns, [key]: value } }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const vitalSigns = Object.fromEntries(Object.entries(form.vitalSigns).filter(([, value]) => value !== '' && value !== null && value !== undefined));
    const payload = { ...form, vitalSigns };
    if (!payload.appointment) delete payload.appointment;
    if (!payload.followUpDate) delete payload.followUpDate;
    if (!payload.encounterDate) delete payload.encounterDate;
    if (encounter) {
      delete payload.patient;
      delete payload.appointment;
    }
    try {
      if (encounter) await api.put(`/encounters/${encounter._id}`, payload);
      else await api.post('/encounters', payload);
      toast.success(encounter ? 'Encounter updated' : 'Encounter created');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const readOnly = Boolean(encounter) && !canWrite;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={encounter ? `Encounter ${encounter.encounterId}` : 'New clinical encounter'}
      description={encounter ? `${fullName(encounter.patient)} · ${doctorName(encounter.doctor)}` : 'Record a consultation and clinical findings.'}
      size="lg"
      footer={
        readOnly ? <Button variant="secondary" onClick={onClose}>Close</Button> : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" form="encounter-form" loading={saving}>{encounter ? 'Save encounter' : 'Create encounter'}</Button>
          </>
        )
      }
    >
      <form id="encounter-form" onSubmit={submit} className="space-y-5">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Patient" required>
            <Select required disabled={Boolean(encounter)} value={form.patient} onChange={(e) => { set('patient', e.target.value); set('appointment', ''); }}>
              <option value="">Select patient…</option>
              {patients.map((patient) => <option key={patient._id} value={patient._id}>{fullName(patient)} · {patient.patientId}</option>)}
            </Select>
          </Field>
          {!encounter ? (
            <Field label="Appointment" hint="Optional. Only appointments for the selected patient are shown.">
              <Select disabled={!form.patient} value={form.appointment} onChange={(e) => set('appointment', e.target.value)}>
                <option value="">Walk-in / no appointment</option>
                {appointments.map((appointment) => (
                  <option key={appointment._id} value={appointment._id}>{appointment.appointmentNumber} · {formatDate(appointment.date)} {formatTime(appointment.startTime)}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Doctor"><Input disabled value={doctorName(encounter.doctor)} /></Field>
          )}
          <Field label="Encounter date"><Input type="date" disabled={readOnly} value={form.encounterDate} onChange={(e) => set('encounterDate', e.target.value)} /></Field>
          <Field label="Visit type">
            <Select disabled={readOnly} value={form.visitType} onChange={(e) => set('visitType', e.target.value)}>
              {VISIT_TYPES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select disabled={readOnly} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {ENCOUNTER_STATUSES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
            </Select>
          </Field>
          <Field label="Follow-up date"><Input type="date" disabled={readOnly} value={form.followUpDate} onChange={(e) => set('followUpDate', e.target.value)} /></Field>
        </div>

        <Field label="Chief complaint" required><Textarea required disabled={readOnly} rows={2} value={form.chiefComplaint} onChange={(e) => set('chiefComplaint', e.target.value)} /></Field>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Vital signs</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Temperature (°C)"><Input type="number" step="0.1" min="25" max="45" disabled={readOnly} value={form.vitalSigns.temperatureC} onChange={(e) => setVital('temperatureC', e.target.value)} /></Field>
            <Field label="Blood pressure"><Input placeholder="120/80" disabled={readOnly} value={form.vitalSigns.bloodPressure} onChange={(e) => setVital('bloodPressure', e.target.value)} /></Field>
            <Field label="Heart rate (bpm)"><Input type="number" min="20" max="300" disabled={readOnly} value={form.vitalSigns.heartRate} onChange={(e) => setVital('heartRate', e.target.value)} /></Field>
            <Field label="Weight (kg)"><Input type="number" step="0.1" min="0.5" max="500" disabled={readOnly} value={form.vitalSigns.weightKg} onChange={(e) => setVital('weightKg', e.target.value)} /></Field>
            <Field label="Height (cm)"><Input type="number" step="0.1" min="20" max="260" disabled={readOnly} value={form.vitalSigns.heightCm} onChange={(e) => setVital('heightCm', e.target.value)} /></Field>
            <Field label="Oxygen saturation (%)"><Input type="number" min="0" max="100" disabled={readOnly} value={form.vitalSigns.oxygenSaturation} onChange={(e) => setVital('oxygenSaturation', e.target.value)} /></Field>
          </div>
        </div>

        <Field label="Clinical notes"><Textarea rows={4} disabled={readOnly} value={form.clinicalNotes} onChange={(e) => set('clinicalNotes', e.target.value)} /></Field>
        <Field label="Treatment plan"><Textarea rows={4} disabled={readOnly} value={form.treatmentNotes} onChange={(e) => set('treatmentNotes', e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
