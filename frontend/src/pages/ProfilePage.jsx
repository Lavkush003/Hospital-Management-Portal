import { useState } from 'react';
import { KeyRound, Mail, Phone, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Avatar,
  Badge,
  Button,
  Field,
  Input,
  PageHeader,
  StatusBadge,
} from '../components/ui';
import { ROLE_LABELS } from '../lib/constants';
import { formatDateTime, fullName } from '../lib/utils';

export default function ProfilePage() {
  const { user, doctor } = useAuth();

  return (
    <div>
      <PageHeader title="My profile" description="Account details, clinical assignment and password security." />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-24 rounded-t-2xl bg-gradient-to-r from-slate-900 via-teal-900 to-cyan-800" />
          <div className="px-6 pb-6">
            <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
              <Avatar firstName={user.firstName} lastName={user.lastName} size="lg" className="ring-4 ring-white" />
              <StatusBadge status={user.status} />
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">{fullName(user)}</h2>
            <p className="text-sm text-slate-500">{ROLE_LABELS[user.role]}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <InfoRow icon={Mail} label="Email" value={user.email} />
              <InfoRow icon={Phone} label="Phone" value={user.phone || 'Not provided'} />
              <InfoRow icon={ShieldCheck} label="Role" value={ROLE_LABELS[user.role]} />
              <InfoRow icon={UserRound} label="Last login" value={formatDateTime(user.lastLoginAt)} />
            </div>

            {user.role === 'DOCTOR' && doctor ? (
              <div className="mt-6 rounded-xl border border-teal-100 bg-teal-50/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-teal-900">
                  <Stethoscope size={16} /> Clinical profile
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <p><span className="text-teal-700/70">Doctor ID:</span> <span className="font-semibold text-teal-900">{doctor.doctorId}</span></p>
                  <p><span className="text-teal-700/70">Specialization:</span> <span className="font-semibold text-teal-900">{doctor.specialization}</span></p>
                  <p className="sm:col-span-2"><span className="text-teal-700/70">Department:</span> <span className="font-semibold text-teal-900">{doctor.department?.name || '—'}</span></p>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              <Badge tone="success">Account secured</Badge>
              <Badge tone="info">JWT session</Badge>
              <Badge tone="neutral">Role-based access</Badge>
            </div>
          </div>
        </div>

        <ChangePasswordCard />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password updated');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <KeyRound size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Change password</h3>
          <p className="text-xs text-slate-400">Use at least 8 characters.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <Field label="Current password" required>
          <Input type="password" required autoComplete="current-password" value={form.currentPassword} onChange={(e) => set('currentPassword', e.target.value)} />
        </Field>
        <Field label="New password" required hint="Minimum 8 characters.">
          <Input type="password" required minLength="8" autoComplete="new-password" value={form.newPassword} onChange={(e) => set('newPassword', e.target.value)} />
        </Field>
        <Field label="Confirm new password" required>
          <Input type="password" required minLength="8" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} />
        </Field>
        <Button type="submit" loading={saving} className="w-full">Update password</Button>
      </form>

      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
        Profile details are managed by hospital administrators. Contact an administrator to update your name, email, phone or role.
      </div>
    </div>
  );
}
