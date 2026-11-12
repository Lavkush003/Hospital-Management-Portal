import { useState } from 'react';
import type { Department } from '@/types/api';
import type { DepartmentInput } from '@/services/hms';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Input';
import { FormError } from '@/components/feedback/FormBits';

interface Values {
  code: string;
  name: string;
  description: string;
  location: string;
  phone: string;
  isActive: boolean;
}

function valuesFor(department: Department | null | undefined): Values {
  return {
    code: department?.code ?? '',
    name: department?.name ?? '',
    description: department?.description ?? '',
    location: department?.location ?? '',
    phone: department?.phone ?? '',
    isActive: department?.isActive ?? true,
  };
}

export function DepartmentForm({
  department,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  department?: Department | null;
  pending: boolean;
  error: unknown;
  onSubmit: (input: DepartmentInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Values>(() => valuesFor(department));
  const [message, setMessage] = useState('');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!values.code.trim() || !values.name.trim()) {
      setMessage('Department code and name are required.');
      return;
    }

    onSubmit({
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      location: values.location.trim() || undefined,
      phone: values.phone.trim() || undefined,
      isActive: values.isActive,
    });
  }

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department code" required hint="Short unique code, e.g. CARD.">
          <Input
            value={values.code}
            maxLength={20}
            onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
          />
        </Field>
        <Field label="Department name" required>
          <Input
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>
        <Field label="Location">
          <Input
            value={values.location}
            onChange={(event) => setValues((current) => ({ ...current, location: event.target.value }))}
          />
        </Field>
        <Field label="Phone">
          <Input
            type="tel"
            value={values.phone}
            onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))}
          />
        </Field>
      </div>
      <Field label="Description">
        <Textarea
          rows={3}
          value={values.description}
          onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
        />
      </Field>
      <Checkbox
        label="Department is active"
        checked={values.isActive}
        onChange={(event) => setValues((current) => ({ ...current, isActive: event.target.checked }))}
      />
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
          {department ? 'Save changes' : 'Create department'}
        </Button>
      </div>
    </form>
  );
}
