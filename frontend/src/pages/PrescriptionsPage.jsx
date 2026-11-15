import { useCallback, useEffect, useState } from 'react';
import { Eye, Pencil, Pill, Plus, Search, Trash2 } from 'lucide-react';
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
  Table,
  Td,
  Textarea,
  Th,
  Tr,
} from '../components/ui';
import { doctorName, formatDate, fullName, toInputDate, todayKey } from '../lib/utils';

function emptyMedicine() {
  return { name: '', dosage: '', frequency: '', duration: '', instructions: '' };
}

export default function PrescriptionsPage() {
  const { user } = useAuth();
  const canWrite = user.role === 'DOCTOR';
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
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
      const response = await api.get('/prescriptions', { params: { page, limit: 10, search, doctor } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, doctor]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Prescriptions"
        description="Medication orders issued from clinical encounters."
        actions={canWrite ? <Button onClick={() => { setSelected(null); setModalOpen(true); }}><Plus size={16} /> New prescription</Button> : null}
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search prescription ID, patient or medicine…" className="pl-9" />
        </div>
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
        <EmptyState title="No prescriptions found" description="Prescriptions issued during encounters will appear here." icon={Pill} />
      ) : (
        <Table>
          <thead><tr><Th>Prescription</Th><Th>Patient</Th><Th>Doctor</Th><Th>Encounter</Th><Th>Date</Th><Th>Medicines</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody>
            {items.map((prescription) => (
              <Tr key={prescription._id}>
                <Td><Badge tone="neutral">{prescription.prescriptionId}</Badge></Td>
                <Td>
                  <p className="font-semibold text-slate-800">{fullName(prescription.patient)}</p>
                  <p className="text-[11px] text-slate-400">{prescription.patient?.patientId}</p>
                </Td>
                <Td>{doctorName(prescription.doctor)}</Td>
                <Td>{prescription.encounter?.encounterId || '—'}</Td>
                <Td>{formatDate(prescription.prescriptionDate)}</Td>
                <Td>
                  <p className="max-w-xs truncate">{(prescription.medicines || []).map((medicine) => medicine.name).join(', ') || '—'}</p>
                  <p className="text-[11px] text-slate-400">{prescription.medicines?.length || 0} item(s)</p>
                </Td>
                <Td className="text-right">
                  <IconButton label={canWrite ? 'Edit prescription' : 'View prescription'} onClick={() => { setSelected(prescription); setModalOpen(true); }}>
                    {canWrite ? <Pencil size={15} /> : <Eye size={15} />}
                  </IconButton>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}

      <PrescriptionFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        prescription={selected}
        patients={patients}
        canWrite={canWrite}
        onSaved={load}
      />
    </div>
  );
}

function PrescriptionFormModal({ open, onClose, prescription, patients, canWrite, onSaved }) {
  const [form, setForm] = useState({ patient: '', encounter: '', prescriptionDate: todayKey(), notes: '' });
  const [medicines, setMedicines] = useState([emptyMedicine()]);
  const [encounters, setEncounters] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setEncounters([]);
    if (prescription) {
      setForm({
        patient: prescription.patient?._id || prescription.patient || '',
        encounter: prescription.encounter?._id || prescription.encounter || '',
        prescriptionDate: toInputDate(prescription.prescriptionDate),
        notes: prescription.notes || '',
      });
      setMedicines(prescription.medicines?.length ? prescription.medicines.map((medicine) => ({
        name: medicine.name || '',
        dosage: medicine.dosage || '',
        frequency: medicine.frequency || '',
        duration: medicine.duration || '',
        instructions: medicine.instructions || '',
      })) : [emptyMedicine()]);
    } else {
      setForm({ patient: '', encounter: '', prescriptionDate: todayKey(), notes: '' });
      setMedicines([emptyMedicine()]);
    }
  }, [open, prescription]);

  useEffect(() => {
    if (!open || prescription || !form.patient || !canWrite) return;
    api.get('/encounters', { params: { patient: form.patient, limit: 100 } })
      .then((response) => setEncounters(response.data.data || []))
      .catch(() => setEncounters([]));
  }, [open, prescription, form.patient, canWrite]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setMedicine = (index, key, value) => setMedicines((current) => current.map((medicine, itemIndex) => (
    itemIndex === index ? { ...medicine, [key]: value } : medicine
  )));
  const addMedicine = () => setMedicines((current) => [...current, emptyMedicine()]);
  const removeMedicine = (index) => setMedicines((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (prescription) {
        await api.put(`/prescriptions/${prescription._id}`, {
          medicines,
          notes: form.notes,
          prescriptionDate: form.prescriptionDate || undefined,
        });
      } else {
        await api.post('/prescriptions', { ...form, medicines });
      }
      toast.success(prescription ? 'Prescription updated' : 'Prescription created');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const readOnly = Boolean(prescription) && !canWrite;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={prescription ? `Prescription ${prescription.prescriptionId}` : 'New prescription'}
      description={prescription ? `${fullName(prescription.patient)} · ${doctorName(prescription.doctor)}` : 'Prescribe medicines against a clinical encounter.'}
      size="lg"
      footer={
        readOnly ? <Button variant="secondary" onClick={onClose}>Close</Button> : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" form="prescription-form" loading={saving}>{prescription ? 'Save prescription' : 'Issue prescription'}</Button>
          </>
        )
      }
    >
      <form id="prescription-form" onSubmit={submit} className="space-y-5">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Patient" required>
            <Select required disabled={Boolean(prescription)} value={form.patient} onChange={(e) => { set('patient', e.target.value); set('encounter', ''); }}>
              <option value="">Select patient…</option>
              {patients.map((patient) => <option key={patient._id} value={patient._id}>{fullName(patient)} · {patient.patientId}</option>)}
            </Select>
          </Field>
          <Field label="Encounter" required>
            <Select required disabled={Boolean(prescription) || !form.patient} value={form.encounter} onChange={(e) => set('encounter', e.target.value)}>
              <option value="">Select encounter…</option>
              {encounters.map((encounter) => (
                <option key={encounter._id} value={encounter._id}>{encounter.encounterId} · {formatDate(encounter.encounterDate)} · {encounter.chiefComplaint}</option>
              ))}
            </Select>
          </Field>
          <Field label="Prescription date"><Input type="date" disabled={readOnly} value={form.prescriptionDate} onChange={(e) => set('prescriptionDate', e.target.value)} /></Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medicines</p>
            {!readOnly ? <Button type="button" size="sm" variant="secondary" onClick={addMedicine}><Plus size={14} /> Add medicine</Button> : null}
          </div>
          <div className="space-y-3">
            {medicines.map((medicine, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Medicine {index + 1}</span>
                  {!readOnly && medicines.length > 1 ? (
                    <IconButton label="Remove medicine" className="text-rose-500 hover:bg-rose-50 hover:text-rose-700" onClick={() => removeMedicine(index)}><Trash2 size={14} /></IconButton>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Medicine name" required><Input required disabled={readOnly} value={medicine.name} onChange={(e) => setMedicine(index, 'name', e.target.value)} /></Field>
                  <Field label="Dosage" required><Input required disabled={readOnly} placeholder="500 mg" value={medicine.dosage} onChange={(e) => setMedicine(index, 'dosage', e.target.value)} /></Field>
                  <Field label="Frequency" required><Input required disabled={readOnly} placeholder="Twice daily" value={medicine.frequency} onChange={(e) => setMedicine(index, 'frequency', e.target.value)} /></Field>
                  <Field label="Duration" required><Input required disabled={readOnly} placeholder="7 days" value={medicine.duration} onChange={(e) => setMedicine(index, 'duration', e.target.value)} /></Field>
                </div>
                <Field label="Instructions" className="mt-3"><Input disabled={readOnly} placeholder="After meals" value={medicine.instructions} onChange={(e) => setMedicine(index, 'instructions', e.target.value)} /></Field>
              </div>
            ))}
          </div>
        </div>

        <Field label="Notes"><Textarea rows={3} disabled={readOnly} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
