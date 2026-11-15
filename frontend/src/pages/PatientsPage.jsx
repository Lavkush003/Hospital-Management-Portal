import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import PatientFormModal from '../components/PatientFormModal';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  IconButton,
  Input,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Td,
  Th,
  Tr,
} from '../components/ui';
import { BLOOD_GROUP_LABELS, GENDERS } from '../lib/constants';
import { calcAge, formatDate, fullName, titleCase } from '../lib/utils';

export default function PatientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = user.role !== 'DOCTOR';
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [gender, setGender] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/patients', { params: { page, limit: 10, search, status, gender } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, status, gender]);

  useEffect(() => {
    load();
  }, [load]);

  const onSaved = () => {
    setModalOpen(false);
    setSelected(null);
    load();
  };

  const toggleStatus = async (patient) => {
    const next = patient.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/patients/${patient._id}/status`, { status: next });
      toast.success(`Patient marked ${next.toLowerCase()}`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Patient registry"
        description="Search, register and maintain patient demographic records."
        actions={
          canManage ? (
            <Button onClick={() => { setSelected(null); setModalOpen(true); }}>
              <UserPlus size={16} /> Register patient
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search by name, ID, phone or email…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
        <Select value={gender} onChange={(e) => { setGender(e.target.value); setPage(1); }}>
          <option value="">All genders</option>
          {GENDERS.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}
        </Select>
      </div>

      {loading ? <Spinner /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No patients found"
          description={search || status || gender ? 'Try adjusting your filters.' : 'Register the first patient to get started.'}
          icon={Users}
          action={canManage ? <Button onClick={() => setModalOpen(true)}><Plus size={16} /> Register patient</Button> : null}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Patient</Th>
              <Th>Patient ID</Th>
              <Th>Age / gender</Th>
              <Th>Contact</Th>
              <Th>Blood group</Th>
              <Th>Status</Th>
              <Th>Registered</Th>
              {canManage ? <Th className="text-right">Actions</Th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((patient) => (
              <Tr key={patient._id} onClick={() => navigate(`/patients/${patient._id}`)}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar firstName={patient.firstName} lastName={patient.lastName} size="sm" />
                    <div>
                      <p className="font-semibold text-slate-800">{fullName(patient)}</p>
                      <p className="text-[11px] text-slate-400">{patient.email || 'No email on file'}</p>
                    </div>
                  </div>
                </Td>
                <Td><Badge tone="neutral">{patient.patientId}</Badge></Td>
                <Td>{calcAge(patient.dateOfBirth)} · {titleCase(patient.gender)}</Td>
                <Td>{patient.phone}</Td>
                <Td>{BLOOD_GROUP_LABELS[patient.bloodGroup] || patient.bloodGroup || '—'}</Td>
                <Td><StatusBadge status={patient.status} /></Td>
                <Td>{formatDate(patient.registrationDate)}</Td>
                {canManage ? (
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                      <IconButton label="Edit patient" onClick={() => { setSelected(patient); setModalOpen(true); }}>
                        <Pencil size={15} />
                      </IconButton>
                      {user.role === 'ADMIN' ? (
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(patient)}>
                          {patient.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                ) : null}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}

      <PatientFormModal open={modalOpen} onClose={() => { setModalOpen(false); setSelected(null); }} patient={selected} onSaved={onSaved} />
    </div>
  );
}
