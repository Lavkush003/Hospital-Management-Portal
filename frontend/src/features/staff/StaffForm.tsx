import { useState } from 'react';
import type { Department, Staff } from '@/types/api';
import type { StaffInput } from '@/services/hms';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Input';
import { FormError } from '@/components/feedback/FormBits';

interface Values {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  employeeCode: string;
  departmentId: string;
  jobTitle: string;
  status: string;
  role: string;
  hiredAt: string;
}

function valuesFor(staff: Staff | null | undefined): Values {
  return {
    firstName: staff?.firstName ?? '',
    lastName: staff?.lastName ?? '',
    email: staff?.email ?? '',
    password: '',
    phone: staff?.phone ?? '',
    employeeCode: staff?.employeeCode ?? '',
    departmentId: staff?.departmentId ?? '',
    jobTitle: staff?.jobTitle ?? '',
    status: staff?.status ?? 'ACTIVE',
    role: staff?.user.role ?? 'FRONT_DESK',
    hiredAt: staff?.hiredAt ? staff.hiredAt.slice(0, 10) : '',
  };
}

export function StaffForm({
  staff,
  departments,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  staff?: Staff | null;
  departments: Department[];
  pending: boolean;
  error: unknown;
  onSubmit: (input: StaffInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>(() => valuesFor(staff));
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
    if (!staff && values.password.length < 12) {
      setMessage('The initial password must be at least 12 characters.');
      return;
    }
    if (!values.employeeCode.trim() || !values.jobTitle.trim()) {
      setMessage('Employee code and job title are required.');
      return;
    }

    onSubmit({
      email: values.email.trim().toLowerCase(),
      ...(staff ? {} : { password: values.password }),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      phone: values.phone.trim() || undefined,
      employeeCode: values.employeeCode.trim(),
      departmentId: values.departmentId || null,
      jobTitle: values.jobTitle.trim(),
      status: values.status as StaffInput['status'],
      role: values.role as StaffInput['role'],
      hiredAt: values.hiredAt || null,
    });
  }

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <Input value={values.firstName} onChange={(event) => set('firstName', event.target.value)} />
        </Field>
        <Field label="Last name" required>
          <Input value={values.lastName} onChange={(event) => set('lastName', event.target.value)} />
        </Field>
        <Field label="Email address" required>
          <Input type="email" value={values.email} onChange={(event) => set('email', event.target.value)} />
        </Field>
        {staff ? null : (
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
          <Input value={values.employeeCode} onChange={(event) => set('employeeCode', event.target.value)} />
        </Field>
        <Field label="Job title" required>
          <Input value={values.jobTitle} onChange={(event) => set('jobTitle', event.target.value)} />
        </Field>
        <Field label="Department">
          <Select value={values.departmentId} onChange={(event) => set('departmentId', event.target.value)}>
            <option value="">No department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="System role" required hint="Controls access to the front desk or administration.">
          <Select value={values.role} onChange={(event) => set('role', event.target.value)}>
            <option value="FRONT_DESK">Front desk</option>
            <option value="ADMIN">Administrator</option>
          </Select>
        </Field>
        <Field label="Employment status">
          <Select value={values.status} onChange={(event) => set('status', event.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On leave</option>
            <option value="INACTIVE">Inactive</option>
            <option value="TERMINATED">Terminated</option>
          </Select>
        </Field>
        <Field label="Hire date">
          <Input type="date" value={values.hiredAt} onChange={(event) => set('hiredAt', event.target.value)} />
        </Field>
      </div>

      {message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
      <FormError error={error} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {staff ? 'Save changes' : 'Create staff account'}
        </Button>
      </div>
    </form>
  );
}
