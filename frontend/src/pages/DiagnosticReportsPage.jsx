import { useCallback, useEffect, useState } from 'react';
import { FileText, Pencil, Plus, Search } from 'lucide-react';
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
import { REPORT_CATEGORIES, REPORT_STATUSES } from '../lib/constants';
import { doctorName, formatDate, fullName, titleCase, toInputDate, todayKey } from '../lib/utils';

const emptyForm = {
  patient: '',
  encounter: '',
  testName: '',
  testCategory: 'Laboratory',
  reportDate: todayKey(),
  status: 'ORDERED',
  notes: '',
  fileReference: '',
};

export default function DiagnosticReportsPage() {
  const { user } = useAuth();
  const canCreate = user.role === 'DOCTOR';
  const canUpdate = ['ADMIN', 'DOCTOR'].includes(user.role);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
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
      const response = await api.get('/diagnostic-reports', { params: { page, limit: 10, search, status, testCategory: category, doctor } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, status, category, doctor]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Diagnostic reports"
        description="Laboratory, imaging and diagnostic test orders and results."
        actions={canCreate ? <Button onClick={() => { setSelected(null); setModalOpen(true); }}><Plus size={16} /> Order diagnostic test</Button> : null}
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_170px_190px_220px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search report ID, patient or test…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {REPORT_STATUSES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
        </Select>
        <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {REPORT_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
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
        <EmptyState title="No diagnostic reports found" description="Diagnostic orders and results will appear here." icon={FileText} />
      ) : (
        <Table>
          <thead><tr><Th>Report</Th><Th>Patient</Th><Th>Test</Th><Th>Category</Th><Th>Ordered by</Th><Th>Report date</Th><Th>Status</Th>{canUpdate ? <Th className="text-right">Actions</Th> : null}</tr></thead>
          <tbody>
            {items.map((report) => (
              <Tr key={report._id}>
                <Td><Badge tone="neutral">{report.reportId}</Badge></Td>
                <Td>
                  <p className="font-semibold text-slate-800">{fullName(report.patient)}</p>
                  <p className="text-[11px] text-slate-400">{report.patient?.patientId}</p>
                </Td>
                <Td><p className="max-w-xs truncate font-medium text-slate-700">{report.testName}</p></Td>
                <Td><Badge tone="info">{report.testCategory}</Badge></Td>
                <Td>{doctorName(report.doctor)}</Td>
                <Td>{formatDate(report.reportDate)}</Td>
                <Td><StatusBadge status={report.status} /></Td>
                {canUpdate ? (
                  <Td className="text-right">
                    <IconButton label="Update report" onClick={() => { setSelected(report); setModalOpen(true); }}><Pencil size={15} /></IconButton>
                  </Td>
                ) : null}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}

      <ReportFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        report={selected}
        patients={patients}
        canCreate={canCreate}
        canUpdate={canUpdate}
        onSaved={load}
      />
    </div>
  );
}

function ReportFormModal({ open, onClose, report, patients, canCreate, canUpdate, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [encounters, setEncounters] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setEncounters([]);
    setForm(report ? {
      patient: report.patient?._id || report.patient || '',
      encounter: report.encounter?._id || report.encounter || '',
      testName: report.testName || '',
      testCategory: report.testCategory || 'Laboratory',
      reportDate: toInputDate(report.reportDate),
      status: report.status || 'ORDERED',
      notes: report.notes || '',
      fileReference: report.fileReference || '',
    } : emptyForm);
  }, [open, report]);

  useEffect(() => {
    if (!open || report || !form.patient || !canCreate) return;
    api.get('/encounters', { params: { patient: form.patient, limit: 100 } })
      .then((response) => setEncounters(response.data.data || []))
      .catch(() => setEncounters([]));
  }, [open, report, form.patient, canCreate]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (report) {
        await api.put(`/diagnostic-reports/${report._id}`, {
          testName: form.testName,
          testCategory: form.testCategory,
          reportDate: form.reportDate || undefined,
          status: form.status,
          notes: form.notes,
          fileReference: form.fileReference,
        });
      } else {
        const payload = { ...form };
        if (!payload.encounter) delete payload.encounter;
        await api.post('/diagnostic-reports', payload);
      }
      toast.success(report ? 'Report updated' : 'Diagnostic test ordered');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !canUpdate;
  const canSave = report ? canUpdate : canCreate;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={report ? `Diagnostic report ${report.reportId}` : 'Order diagnostic test'}
      description={report ? `${fullName(report.patient)} · ${doctorName(report.doctor)}` : 'Create a diagnostic order for an assigned patient.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          {canSave ? <Button type="submit" form="report-form" loading={saving}>{report ? 'Save report' : 'Create order'}</Button> : null}
        </>
      }
    >
      <form id="report-form" onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Patient" required>
            <Select required disabled={Boolean(report)} value={form.patient} onChange={(e) => { set('patient', e.target.value); set('encounter', ''); }}>
              <option value="">Select patient…</option>
              {patients.map((patient) => <option key={patient._id} value={patient._id}>{fullName(patient)} · {patient.patientId}</option>)}
            </Select>
          </Field>
          <Field label="Encounter" hint="Optional. Link the order to a visit.">
            <Select disabled={Boolean(report) || !form.patient} value={form.encounter} onChange={(e) => set('encounter', e.target.value)}>
              <option value="">No linked encounter</option>
              {encounters.map((encounter) => (
                <option key={encounter._id} value={encounter._id}>{encounter.encounterId} · {formatDate(encounter.encounterDate)}</option>
              ))}
            </Select>
          </Field>
          <Field label="Test name" required><Input required disabled={readOnly} value={form.testName} onChange={(e) => set('testName', e.target.value)} placeholder="Complete blood count" /></Field>
          <Field label="Test category" required>
            <Select required disabled={readOnly} value={form.testCategory} onChange={(e) => set('testCategory', e.target.value)}>
              {REPORT_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </Field>
          <Field label="Report date"><Input type="date" disabled={readOnly} value={form.reportDate} onChange={(e) => set('reportDate', e.target.value)} /></Field>
          <Field label="Status">
            <Select disabled={readOnly} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {REPORT_STATUSES.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="File reference" hint="Path or external reference to the uploaded report file."><Input disabled={readOnly} value={form.fileReference} onChange={(e) => set('fileReference', e.target.value)} /></Field>
        <Field label="Notes / findings"><Textarea rows={4} disabled={readOnly} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
