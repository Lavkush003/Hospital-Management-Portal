import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import api, { getErrorMessage } from '../lib/api';
import { BLOOD_GROUPS, BLOOD_GROUP_LABELS, GENDERS } from '../lib/constants';
import { toInputDate } from '../lib/utils';
import { Button, Field, Input, Modal, Select } from './ui';

const emptyForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'MALE',
  phone: '',
  email: '',
  bloodGroup: 'UNKNOWN',
  address: { line1: '', city: '', state: '', postalCode: '' },
  emergencyContact: { name: '', phone: '', relationship: '' },
};

export default function PatientFormModal({ open, onClose, patient, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (patient) {
      setForm({
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        dateOfBirth: toInputDate(patient.dateOfBirth),
        gender: patient.gender || 'MALE',
        phone: patient.phone || '',
        email: patient.email || '',
        bloodGroup: patient.bloodGroup || 'UNKNOWN',
        address: {
          line1: patient.address?.line1 || '',
          city: patient.address?.city || '',
          state: patient.address?.state || '',
          postalCode: patient.address?.postalCode || '',
        },
        emergencyContact: {
          name: patient.emergencyContact?.name || '',
          phone: patient.emergencyContact?.phone || '',
          relationship: patient.emergencyContact?.relationship || '',
        },
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, patient]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setNested = (group, key, value) =>
    setForm((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = patient ? await api.put(`/patients/${patient._id}`, form) : await api.post('/patients', form);
      toast.success(patient ? 'Patient updated' : 'Patient registered');
      onSaved?.(response.data.data);
      onClose();
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patient ? 'Edit patient record' : 'Register new patient'}
      description={patient ? patient.patientId : 'Create a patient chart with demographics and emergency contact details.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="patient-form" loading={saving}>{patient ? 'Save changes' : 'Register patient'}</Button>
        </>
      }
    >
      <form id="patient-form" onSubmit={onSubmit} className="space-y-5">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required><Input required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></Field>
          <Field label="Last name" required><Input required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></Field>
          <Field label="Date of birth" required><Input type="date" required max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} /></Field>
          <Field label="Gender" required>
            <Select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              {GENDERS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
            </Select>
          </Field>
          <Field label="Phone" required><Input required value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+1 555 010 2000" /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="patient@example.com" /></Field>
          <Field label="Blood group">
            <Select value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
              {BLOOD_GROUPS.map((group) => <option key={group} value={group}>{BLOOD_GROUP_LABELS[group]}</option>)}
            </Select>
          </Field>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Address</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address line" className="sm:col-span-2"><Input value={form.address.line1} onChange={(e) => setNested('address', 'line1', e.target.value)} /></Field>
            <Field label="City"><Input value={form.address.city} onChange={(e) => setNested('address', 'city', e.target.value)} /></Field>
            <Field label="State"><Input value={form.address.state} onChange={(e) => setNested('address', 'state', e.target.value)} /></Field>
            <Field label="Postal code"><Input value={form.address.postalCode} onChange={(e) => setNested('address', 'postalCode', e.target.value)} /></Field>
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Emergency contact</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Full name"><Input value={form.emergencyContact.name} onChange={(e) => setNested('emergencyContact', 'name', e.target.value)} /></Field>
            <Field label="Phone"><Input value={form.emergencyContact.phone} onChange={(e) => setNested('emergencyContact', 'phone', e.target.value)} /></Field>
            <Field label="Relationship"><Input value={form.emergencyContact.relationship} onChange={(e) => setNested('emergencyContact', 'relationship', e.target.value)} /></Field>
          </div>
        </div>
      </form>
    </Modal>
  );
}
