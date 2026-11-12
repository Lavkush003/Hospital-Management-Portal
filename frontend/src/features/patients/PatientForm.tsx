import { useState } from 'react';
import type { Patient } from '@/types/api';
import type { PatientInput } from '@/services/hms';
import { bloodGroups, genders } from '@/utils/status';
import { humanize } from '@/utils/format';
import { toDateInput } from '@/utils/date';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { FormError } from '@/components/feedback/FormBits';

interface PatientFormValues {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string;
  notes: string;
  status: string;
}

function initialValues(patient?: Patient | null): PatientFormValues {
  return {
    firstName: patient?.firstName ?? '',
    lastName: patient?.lastName ?? '',
    dateOfBirth: patient?.dateOfBirth.slice(0, 10) ?? '',
    gender: patient?.gender ?? 'UNKNOWN',
    bloodGroup: patient?.bloodGroup ?? 'UNKNOWN',
    phone: patient?.phone ?? '',
    email: patient?.email ?? '',
    addressLine1: patient?.addressLine1 ?? '',
    addressLine2: patient?.addressLine2 ?? '',
    city: patient?.city ?? '',
    state: patient?.state ?? '',
    postalCode: patient?.postalCode ?? '',
    country: patient?.country ?? '',
    emergencyContactName: patient?.emergencyContactName ?? '',
    emergencyContactPhone: patient?.emergencyContactPhone ?? '',
    allergies: patient?.allergies ?? '',
    notes: patient?.notes ?? '',
    status: patient?.status ?? 'ACTIVE',
  };
}

export function PatientForm({
  patient,
  canEditClinical,
  pending,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  patient?: Patient | null;
  canEditClinical: boolean;
  pending: boolean;
  error: unknown;
  submitLabel: string;
  onSubmit: (input: PatientInput) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<PatientFormValues>(() => initialValues(patient));
  const [message, setMessage] = useState('');

  function set<K extends keyof PatientFormValues>(key: K, value: PatientFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!values.firstName.trim() || !values.lastName.trim()) {
      setMessage('First and last name are required.');
      return;
    }
    if (!values.dateOfBirth) {
      setMessage('Date of birth is required.');
      return;
    }

    const optional = (value: string) => (value.trim() ? value.trim() : undefined);

    onSubmit({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      dateOfBirth: values.dateOfBirth,
      gender: values.gender as PatientInput['gender'],
      bloodGroup: values.bloodGroup as PatientInput['bloodGroup'],
      status: values.status as PatientInput['status'],
      phone: optional(values.phone),
      email: optional(values.email),
      addressLine1: optional(values.addressLine1),
      addressLine2: optional(values.addressLine2),
      city: optional(values.city),
      state: optional(values.state),
      postalCode: optional(values.postalCode),
      country: optional(values.country),
      emergencyContactName: optional(values.emergencyContactName),
      emergencyContactPhone: optional(values.emergencyContactPhone),
      ...(canEditClinical
        ? { allergies: optional(values.allergies), notes: optional(values.notes) }
        : {}),
    });
  }

  return (
    <form className="space-y-6" noValidate onSubmit={submit}>
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Patient identity
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required>
            <Input
              autoComplete="given-name"
              value={values.firstName}
              onChange={(event) => set('firstName', event.target.value)}
            />
          </Field>
          <Field label="Last name" required>
            <Input
              autoComplete="family-name"
              value={values.lastName}
              onChange={(event) => set('lastName', event.target.value)}
            />
          </Field>
          <Field label="Date of birth" required>
            <Input
              type="date"
              max={toDateInput(new Date())}
              value={values.dateOfBirth}
              onChange={(event) => set('dateOfBirth', event.target.value)}
            />
          </Field>
          <Field label="Gender">
            <Select value={values.gender} onChange={(event) => set('gender', event.target.value)}>
              {genders.map((gender) => (
                <option key={gender} value={gender}>
                  {humanize(gender)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Blood group">
            <Select
              value={values.bloodGroup}
              onChange={(event) => set('bloodGroup', event.target.value)}
            >
              {bloodGroups.map((group) => (
                <option key={group} value={group}>
                  {humanize(group).replace(' Positive', '+').replace(' Negative', '−')}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Patient status">
            <Select value={values.status} onChange={(event) => set('status', event.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DECEASED">Deceased</option>
            </Select>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(event) => set('phone', event.target.value)}
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => set('email', event.target.value)}
            />
          </Field>
          <Field label="Address line 1" className="sm:col-span-2">
            <Input
              autoComplete="address-line1"
              value={values.addressLine1}
              onChange={(event) => set('addressLine1', event.target.value)}
            />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <Input
              autoComplete="address-line2"
              value={values.addressLine2}
              onChange={(event) => set('addressLine2', event.target.value)}
            />
          </Field>
          <Field label="City">
            <Input
              autoComplete="address-level2"
              value={values.city}
              onChange={(event) => set('city', event.target.value)}
            />
          </Field>
          <Field label="State / region">
            <Input
              autoComplete="address-level1"
              value={values.state}
              onChange={(event) => set('state', event.target.value)}
            />
          </Field>
          <Field label="Postal code">
            <Input
              autoComplete="postal-code"
              value={values.postalCode}
              onChange={(event) => set('postalCode', event.target.value)}
            />
          </Field>
          <Field label="Country">
            <Input
              autoComplete="country-name"
              value={values.country}
              onChange={(event) => set('country', event.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Emergency contact
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name">
            <Input
              value={values.emergencyContactName}
              onChange={(event) => set('emergencyContactName', event.target.value)}
            />
          </Field>
          <Field label="Contact phone">
            <Input
              type="tel"
              value={values.emergencyContactPhone}
              onChange={(event) => set('emergencyContactPhone', event.target.value)}
            />
          </Field>
        </div>
      </section>

      {canEditClinical ? (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Clinical flags
          </h3>
          <Field label="Allergies">
            <Textarea
              rows={2}
              placeholder="Known allergies, reactions and severity"
              value={values.allergies}
              onChange={(event) => set('allergies', event.target.value)}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              rows={3}
              placeholder="Administrative or clinical notes"
              value={values.notes}
              onChange={(event) => set('notes', event.target.value)}
            />
          </Field>
        </section>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
      <FormError error={error} />

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        {onCancel ? (
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
