import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  FileHeart,
  HeartPulse,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Pill,
  Plus,
  ReceiptText,
  UserRound,
} from 'lucide-react';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PatientFormModal from '../components/PatientFormModal';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Spinner,
  StatusBadge,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { BLOOD_GROUP_LABELS } from '../lib/constants';
import { calcAge, doctorName, formatCurrency, formatDate, formatDateTime, formatTime, fullName, titleCase } from '../lib/utils';

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon size={15} /></span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm text-slate-700">{value || '—'}</p>
      </div>
    </div>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user.role !== 'DOCTOR';
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('appointments');
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [patientResponse, historyResponse] = await Promise.all([
        api.get(`/patients/${id}`),
        api.get(`/patients/${id}/history`),
      ]);
      setPatient(patientResponse.data.data);
      setHistory(historyResponse.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label="Loading patient record…" />;
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        <p className="font-semibold">Could not open patient record</p>
        <p className="mt-1">{error}</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate('/patients')}>Back to patients</Button>
      </div>
    );
  }

  const tabs = [
    { value: 'appointments', label: `Appointments (${history?.appointments?.length || 0})` },
    { value: 'encounters', label: `Encounters (${history?.encounters?.length || 0})` },
    { value: 'prescriptions', label: `Prescriptions (${history?.prescriptions?.length || 0})` },
    { value: 'reports', label: `Reports (${history?.reports?.length || 0})` },
    { value: 'invoices', label: `Invoices (${history?.invoices?.length || 0})` },
  ];

  return (
    <div>
      <Link to="/patients" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Back to patients
      </Link>
      <PageHeader
        title="Patient record"
        description={`Complete demographic and clinical history for ${fullName(patient)}.`}
        actions={
          <>
            {canManage ? <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil size={16} /> Edit record</Button> : null}
            {user.role === 'RECEPTIONIST' || user.role === 'ADMIN' ? (
              <Link to="/appointments"><Button><Plus size={16} /> Book appointment</Button></Link>
            ) : (
              <Link to="/encounters"><Button><HeartPulse size={16} /> Clinical encounter</Button></Link>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar firstName={patient.firstName} lastName={patient.lastName} size="lg" />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-slate-900">{fullName(patient)}</h2>
                <p className="text-xs text-slate-400">{patient.patientId}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge status={patient.status} />
                  {patient.bloodGroup ? <Badge tone="danger">{BLOOD_GROUP_LABELS[patient.bloodGroup] || patient.bloodGroup}</Badge> : null}
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
              <InfoRow icon={UserRound} label="Age / gender" value={`${calcAge(patient.dateOfBirth)} · ${titleCase(patient.gender)}`} />
              <InfoRow icon={CalendarDays} label="Date of birth" value={formatDate(patient.dateOfBirth)} />
              <InfoRow icon={Phone} label="Phone" value={patient.phone} />
              <InfoRow icon={Mail} label="Email" value={patient.email} />
              <InfoRow
                icon={MapPin}
                label="Address"
                value={[patient.address?.line1, patient.address?.city, patient.address?.state, patient.address?.postalCode].filter(Boolean).join(', ')}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">Emergency contact</h3>
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{patient.emergencyContact?.name || 'Not provided'}</p>
              <p>{patient.emergencyContact?.phone || '—'}</p>
              <p className="text-xs text-slate-400">{patient.emergencyContact?.relationship || ''}</p>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
              Registered {formatDate(patient.registrationDate)}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Tabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'appointments' ? (
            history.appointments?.length ? (
              <Table className="shadow-none">
                <thead><tr><Th>Appointment</Th><Th>Doctor</Th><Th>Date & time</Th><Th>Type</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {history.appointments.map((item) => (
                    <Tr key={item._id}>
                      <Td><Badge tone="neutral">{item.appointmentNumber}</Badge></Td>
                      <Td>{doctorName(item.doctor)}</Td>
                      <Td>{formatDate(item.date)} · {formatTime(item.startTime)}</Td>
                      <Td>{titleCase(item.appointmentType)}</Td>
                      <Td><StatusBadge status={item.status} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : <EmptyState title="No appointments" description="This patient has no appointment history." icon={CalendarDays} />
          ) : null}

          {tab === 'encounters' ? (
            history.encounters?.length ? (
              <div className="space-y-3">
                {history.encounters.map((item) => (
                  <div key={item._id} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <HeartPulse size={15} className="text-teal-600" />
                        <span className="text-sm font-bold text-slate-800">{item.encounterId}</span>
                        <Badge tone="info">{titleCase(item.visitType)}</Badge>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{item.chiefComplaint}</p>
                    <p className="mt-2 text-[11px] text-slate-400">{doctorName(item.doctor)} · {formatDate(item.encounterDate)}</p>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No encounters" description="Clinical encounters will appear here." icon={HeartPulse} />
          ) : null}

          {tab === 'prescriptions' ? (
            history.prescriptions?.length ? (
              <div className="space-y-3">
                {history.prescriptions.map((item) => (
                  <div key={item._id} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Pill size={15} className="text-violet-600" />
                        <span className="text-sm font-bold text-slate-800">{item.prescriptionId}</span>
                      </div>
                      <span className="text-xs text-slate-400">{formatDate(item.prescriptionDate)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(item.medicines || []).map((medicine) => (
                        <Badge key={medicine.name} tone="purple">{medicine.name} · {medicine.dosage}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="No prescriptions" description="Prescriptions issued to this patient will appear here." icon={Pill} />
          ) : null}

          {tab === 'reports' ? (
            history.reports?.length ? (
              <Table className="shadow-none">
                <thead><tr><Th>Report</Th><Th>Test</Th><Th>Category</Th><Th>Date</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {history.reports.map((item) => (
                    <Tr key={item._id}>
                      <Td><Badge tone="neutral">{item.reportId}</Badge></Td>
                      <Td>{item.testName}</Td>
                      <Td>{item.testCategory}</Td>
                      <Td>{formatDate(item.reportDate)}</Td>
                      <Td><StatusBadge status={item.status} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : <EmptyState title="No diagnostic reports" icon={FileHeart} />
          ) : null}

          {tab === 'invoices' ? (
            history.invoices?.length ? (
              <Table className="shadow-none">
                <thead><tr><Th>Invoice</Th><Th>Date</Th><Th>Total</Th><Th>Paid</Th><Th>Balance</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {history.invoices.map((item) => (
                    <Tr key={item._id}>
                      <Td><Badge tone="neutral">{item.invoiceNumber}</Badge></Td>
                      <Td>{formatDateTime(item.invoiceDate)}</Td>
                      <Td>{formatCurrency(item.totalAmount)}</Td>
                      <Td>{formatCurrency(item.amountPaid)}</Td>
                      <Td className="font-semibold text-slate-800">{formatCurrency(item.balanceDue)}</Td>
                      <Td><StatusBadge status={item.status} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : <EmptyState title="No invoices" icon={ReceiptText} />
          ) : null}
        </div>
      </div>

      <PatientFormModal open={editOpen} onClose={() => setEditOpen(false)} patient={patient} onSaved={load} />
    </div>
  );
}
