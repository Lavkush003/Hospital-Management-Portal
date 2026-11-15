import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import api, { getErrorMessage } from '../lib/api';
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
  Th,
  Tr,
} from '../components/ui';
import { ROLE_LABELS } from '../lib/constants';
import { formatDate, fullName, toInputDate } from '../lib/utils';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'RECEPTIONIST',
  department: '',
  jobTitle: '',
  joiningDate: '',
  password: '',
  status: 'ACTIVE',
};

export default function StaffPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    api.get('/departments', { params: { limit: 100 } })
      .then((response) => setDepartments(response.data.data || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/staff', { params: { page, limit: 10, search, role, status } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, role, status]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (member, next) => {
    try {
      await api.patch(`/staff/${member._id}/status`, { status: next });
      toast.success('Staff status updated');
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Staff accounts"
        description="Administrative and front-office accounts with role-based access."
        actions={<Button onClick={() => { setSelected(null); setModalOpen(true); }}><Plus size={16} /> Add staff account</Button>}
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, employee ID, email or title…" className="pl-9" />
        </div>
        <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          <option value="ADMIN">Administrator</option>
          <option value="RECEPTIONIST">Receptionist</option>
        </Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {['ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED'].map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
        </Select>
      </div>

      {loading ? <Spinner /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No staff accounts found" icon={UserCog} />
      ) : (
        <Table>
          <thead><tr><Th>Employee</Th><Th>Employee ID</Th><Th>Role</Th><Th>Department</Th><Th>Job title</Th><Th>Joined</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
          <tbody>
            {items.map((member) => (
              <Tr key={member._id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar firstName={member.firstName} lastName={member.lastName} size="sm" />
                    <div>
                      <p className="font-semibold text-slate-800">{fullName(member)}</p>
                      <p className="text-[11px] text-slate-400">{member.email}</p>
                    </div>
                  </div>
                </Td>
                <Td><Badge tone="neutral">{member.employeeId}</Badge></Td>
                <Td><Badge tone={member.role === 'ADMIN' ? 'purple' : 'info'}>{ROLE_LABELS[member.role]}</Badge></Td>
                <Td>{member.department?.name || '—'}</Td>
                <Td>{member.jobTitle}</Td>
                <Td>{formatDate(member.joiningDate)}</Td>
                <Td><StatusBadge status={member.status} /></Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Select className="h-8 w-32 py-1 text-xs" value={member.status} onChange={(e) => changeStatus(member, e.target.value)}>
                      {['ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED'].map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
                    </Select>
                    <IconButton label="Edit staff member" onClick={() => { setSelected(member); setModalOpen(true); }}><Pencil size={15} /></IconButton>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}

      <StaffFormModal open={modalOpen} onClose={() => { setModalOpen(false); setSelected(null); }} member={selected} departments={departments} onSaved={load} />
    </div>
  );
}

function StaffFormModal({ open, onClose, member, departments, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(member ? {
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role || 'RECEPTIONIST',
      department: member.department?._id || member.department || '',
      jobTitle: member.jobTitle || '',
      joiningDate: toInputDate(member.joiningDate),
      password: '',
      status: member.status || 'ACTIVE',
    } : emptyForm);
  }, [open, member]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    if (!payload.joiningDate) delete payload.joiningDate;
    try {
      if (member) await api.put(`/staff/${member._id}`, payload);
      else await api.post('/staff', payload);
      toast.success(member ? 'Staff member updated' : 'Staff account created');
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
      title={member ? 'Edit staff account' : 'Add staff account'}
      description={member ? member.employeeId : 'Create a front-office or administrative login.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="staff-form" loading={saving}>{member ? 'Save changes' : 'Create account'}</Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required><Input required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
          <Field label="Last name" required><Input required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
          <Field label="Email" required><Input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Role" required>
            <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="ADMIN">Administrator</option>
            </Select>
          </Field>
          <Field label="Department">
            <Select value={form.department} onChange={(e) => set('department', e.target.value)}>
              <option value="">Unassigned</option>
              {departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
            </Select>
          </Field>
          <Field label="Job title" required><Input required value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="Front Desk Coordinator" /></Field>
          <Field label="Joining date"><Input type="date" value={form.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {['ACTIVE', 'ON_LEAVE', 'INACTIVE', 'TERMINATED'].map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
            </Select>
          </Field>
          {!member ? <Field label="Initial password" hint="Optional. Defaults to the server seed password."><Input type="password" minLength="8" value={form.password} onChange={(e) => set('password', e.target.value)} /></Field> : null}
        </div>
      </form>
    </Modal>
  );
}
