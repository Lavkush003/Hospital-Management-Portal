import { useState } from 'react';
import type { Department, Doctor } from '@/types/api';
import type { DoctorInput } from '@/services/hms';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { FormError } from '@/components/feedback/FormBits';

interface Values {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  employeeCode: string;
  departmentId: string;
  licenseNumber: string;
  specialization: string;
  qualifications: string;
  consultationFee: string;
  status: string;
  bio: string;
}

function valuesFor(doctor: Doctor | null | undefined): Values {
  return {
    firstName: doctor?.firstName ?? '',
    lastName: doctor?.lastName ?? '',
    email: doctor?.email ?? '',
    password: '',
    phone: doctor?.phone ?? '',
    employeeCode: doctor?.employeeCode ?? '',
    departmentId: doctor?.departmentId ?? '',
    licenseNumber: doctor?.licenseNumber ?? '',
    specialization: doctor?.specialization ?? '',
    qualifications: doctor?.qualifications ?? '',
    consultationFee: doctor?.consultationFee ?? '0',
    status: doctor?.status ?? 'ACTIVE',
    bio: doctor?.bio ?? '',
  };
}

export function DoctorForm({
  doctor,
  departments,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  doctor?: Doctor | null;
  departments: Department[];
  pending: boolean;
  error: unknown;
  onSubmit: (input: DoctorInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>(() => valuesFor(doctor));
  const [message, setMessage] = useState('');

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!values.firstName.trim() || !values.lastName.trim()) {
      setMessage('First and last name are required.');
      return;
    }
    if (!values.email.trim()) {
      setMessage('Email address is required.');
      return;
    }
    if (!doctor && values.password.length < 12) {
      setMessage('The initial password must be at least 12 characters.');
      return;
    }
    if (!values.departmentId) {
      setMessage('Select a department.');
      return;
    }
    if (!values.employeeCode.trim() || !values.licenseNumber.trim()) {
      setMessage('Employee code and license number are required.');
      return;
    }
    if (!values.specialization.trim()) {
      setMessage('Specialization is required.');
      return;
    }

    const optional = (value: string) => (value.trim() ? value.trim() : undefined);

    onSubmit({
      email: values.email.trim().toLowerCase(),
      ...(doctor ? {} : { password: values.password }),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: optional(values.phone),
      employeeCode: values.employeeCode.trim(),
      departmentId: values.departmentId,
      licenseNumber: values.licenseNumber.trim(),
      specialization: values.specialization.trim(),
      qualifications: optional(values.qualifications),
      consultationFee: Number(values.consultationFee) || 0,
      status: values.status as DoctorInput['status'],
      bio: optional(values.bio),
    });
  }

  return (
    <form className="space-y-6" noValidate onSubmit={submit}>
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Professional identity
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required>
            <Input value={values.firstName} onChange={(event) => set('firstName', event.target.value)} />
          </Field>
          <Field label="Last name" required>
            <Input value={values.lastName} onChange={(event) => set('lastName', event.target.value)} />
          </Field>
          <Field label="Email address" required>
            <Input
              type="email"
              value={values.email}
              onChange={(event) => set('email', event.target.value)}
            />
          </Field>
          {doctor ? null : (
            <Field label="Initial password" required hint="At least 12 characters.">
              <Input
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(event) => set('password', event.target.value)}
              />
            </Field>
          )}
          <Field label="Phone">
            <Input type="tel" value={values.phone} onChange={(event) => set('phone', event.target.value)} />
          </Field>
          <Field label="Employee code" required>
            <Input
              value={values.employeeCode}
              onChange={(event) => set('employeeCode', event.target.value)}
            />
          </Field>
          <Field label="Department" required>
            <Select
              value={values.departmentId}
              onChange={(event) => set('departmentId', event.target.value)}
            >
              <option value="">Select a department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={values.status} onChange={(event) => set('status', event.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="ON_LEAVE">On leave</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Clinical practice
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="License number" required>
            <Input
              value={values.licenseNumber}
              onChange={(event) => set('licenseNumber', event.target.value)}
            />
          </Field>
          <Field label="Specialization" required>
            <Input
              value={values.specialization}
              onChange={(event) => set('specialization', event.target.value)}
            />
          </Field>
          <Field label="Consultation fee" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={values.consultationFee}
              onChange={(event) => set('consultationFee', event.target.value)}
            />
          </Field>
          <Field label="Qualifications">
            <Input
              value={values.qualifications}
              onChange={(event) => set('qualifications', event.target.value)}
            />
          </Field>
        </div>
        <Field label="Professional bio">
          <Textarea
            rows={3}
            value={values.bio}
            onChange={(event) => set('bio', event.target.value)}
          />
        </Field>
      </section>

      {message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
      <FormError error={error} />
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {doctor ? 'Save changes' : 'Create doctor profile'}
        </Button>
      </div>
    </form>
  );
}
