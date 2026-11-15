import { useCallback, useEffect, useState } from 'react';
import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
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
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
} from '../components/ui';
import { doctorName } from '../lib/utils';

const emptyForm = { name: '', code: '', description: '', location: '', phone: '', head: '', status: 'ACTIVE' };

export default function DepartmentsPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/doctors', { params: { limit: 100 } })
      .then((response) => setDoctors(response.data.data || []))
      .catch(() => {});
  }, [isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/departments', { params: { page, limit: 10, search, status } });
      setItems(response.data.data || []);
      setMeta(response.data.meta);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/departments/${deleteTarget._id}`);
      toast.success('Department deleted');
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
        title="Departments"
        description="Clinical and operational units across the hospital."
        actions={isAdmin ? <Button onClick={() => { setSelected(null); setModalOpen(true); }}><Plus size={16} /> Add department</Button> : null}
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, code or description…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
      </div>

      {loading ? <Spinner /> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState title="No departments found" icon={Building2} />
      ) : (
        <Table>
          <thead>
            <tr><Th>Department</Th><Th>Code</Th><Th>Location</Th><Th>Head</Th><Th>Doctors</Th><Th>Status</Th>{isAdmin ? <Th className="text-right">Actions</Th> : null}</tr>
          </thead>
          <tbody>
            {items.map((department) => (
              <Tr key={department._id}>
                <Td>
                  <p className="font-semibold text-slate-800">{department.name}</p>
                  <p className="max-w-xs truncate text-[11px] text-slate-400">{department.description || 'No description'}</p>
                </Td>
                <Td><Badge tone="info">{department.code}</Badge></Td>
                <Td>{department.location || '—'}</Td>
                <Td>{department.head ? doctorName(department.head) : '—'}</Td>
                <Td>{department.doctorCount || 0}</Td>
                <Td><StatusBadge status={department.status} /></Td>
                {isAdmin ? (
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton label="Edit department" onClick={() => { setSelected(department); setModalOpen(true); }}><Pencil size={15} /></IconButton>
                      <IconButton label="Delete department" className="text-rose-500 hover:bg-rose-50 hover:text-rose-700" onClick={() => setDeleteTarget(department)}><Trash2 size={15} /></IconButton>
                    </div>
                  </Td>
                ) : null}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {meta ? <div className="mt-3 rounded-2xl border border-slate-200 bg-white"><Pagination meta={meta} onPageChange={setPage} /></div> : null}

      <DepartmentFormModal open={modalOpen} onClose={() => { setModalOpen(false); setSelected(null); }} department={selected} doctors={doctors} onSaved={load} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={deleting}
        title="Delete department?"
        confirmLabel="Delete department"
        description={deleteTarget ? `Delete ${deleteTarget.name}? Departments with assigned doctors, staff or appointment history cannot be deleted.` : ''}
      />
    </div>
  );
}

function DepartmentFormModal({ open, onClose, department, doctors, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(department ? {
      name: department.name || '',
      code: department.code || '',
      description: department.description || '',
      location: department.location || '',
      phone: department.phone || '',
      head: department.head?._id || department.head || '',
      status: department.status || 'ACTIVE',
    } : emptyForm);
  }, [open, department]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (department) await api.put(`/departments/${department._id}`, form);
      else await api.post('/departments', form);
      toast.success(department ? 'Department updated' : 'Department created');
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
      title={department ? 'Edit department' : 'Add department'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="department-form" loading={saving}>{department ? 'Save changes' : 'Create department'}</Button>
        </>
      }
    >
      <form id="department-form" onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department name" required><Input required value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Code" required><Input required value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="CARD" /></Field>
          <Field label="Location"><Input value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="Department head">
            <Select value={form.head} onChange={(e) => set('head', e.target.value)}>
              <option value="">Unassigned</option>
              {doctors.map((doctor) => <option key={doctor._id} value={doctor._id}>{doctorName(doctor)}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
        </div>
        <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
