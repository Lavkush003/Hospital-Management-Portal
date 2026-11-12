import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { AuthShell } from '@/features/auth/AuthShell';
import { apiMutate } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Input';
import { FormError } from '@/components/feedback/FormBits';
import { homePathFor } from '@/components/layout/navigation';
import { toDateInput } from '@/utils/date';

interface RegisterForm {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  password: string;
  confirmPassword: string;
}

const initialForm: RegisterForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  email: '',
  phone: '',
  gender: 'UNKNOWN',
  password: '',
  confirmPassword: '',
};

export function RegisterPage() {
  const { user, loading } = useAuth();
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500" role="status">
        Checking your session…
      </div>
    );
  }
  if (user) return <Navigate replace to={homePathFor(user.role)} />;

  function update<K extends keyof RegisterForm>(key: K, value: RegisterForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage('');
    setSuccess('');

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setMessage('Enter your first and last name.');
      return;
    }
    if (!form.dateOfBirth) {
      setMessage('Enter your date of birth.');
      return;
    }
    if (!form.email.trim()) {
      setMessage('Enter your email address.');
      return;
    }
    if (form.password.length < 12) {
      setMessage('Password must be at least 12 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setPending(true);
    try {
      const response = await apiMutate<{ message: string }>(
        '/auth/register',
        'POST',
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dateOfBirth,
          email: form.email.trim(),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          gender: form.gender,
          password: form.password,
        },
        undefined,
      );
      setSuccess(response.message || 'Patient account created. You can now sign in.');
      setForm(initialForm);
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Patient registration"
      title="Create your patient account"
      description="Register a secure account to access your own patient profile. Hospital staff continue to manage clinical records."
      wide
      footer={
        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link className="font-semibold text-brand-700 hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      }
    >
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6" role="status">
          <h3 className="text-sm font-semibold text-emerald-900">Account created</h3>
          <p className="mt-1 text-sm leading-6 text-emerald-800">{success}</p>
          <Link
            to="/login"
            className="mt-4 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Continue to sign in
          </Link>
        </div>
      ) : (
        <form className="space-y-4" noValidate onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="register-first-name" required>
              <Input
                id="register-first-name"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(event) => update('firstName', event.target.value)}
              />
            </Field>
            <Field label="Last name" htmlFor="register-last-name" required>
              <Input
                id="register-last-name"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(event) => update('lastName', event.target.value)}
              />
            </Field>
            <Field label="Date of birth" htmlFor="register-dob" required>
              <Input
                id="register-dob"
                type="date"
                autoComplete="bday"
                max={toDateInput(new Date())}
                value={form.dateOfBirth}
                onChange={(event) => update('dateOfBirth', event.target.value)}
              />
            </Field>
            <Field label="Gender" htmlFor="register-gender">
              <Select
                id="register-gender"
                value={form.gender}
                onChange={(event) =>
                  update('gender', event.target.value as RegisterForm['gender'])
                }
              >
                <option value="UNKNOWN">Prefer not to say</option>
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
            <Field label="Email address" htmlFor="register-email" required>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => update('email', event.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="register-phone" hint="Optional">
              <Input
                id="register-phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
              />
            </Field>
            <Field label="Password" htmlFor="register-password" required hint="At least 12 characters.">
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
              />
            </Field>
            <Field label="Confirm password" htmlFor="register-confirm-password" required>
              <Input
                id="register-confirm-password"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) => update('confirmPassword', event.target.value)}
              />
            </Field>
          </div>
          {message ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {message}
            </p>
          ) : null}
          <FormError error={error} />
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
            Existing hospital patients should contact the front desk so their new account can be
            linked to the existing medical record.
          </p>
          <Button type="submit" className="w-full" size="lg" loading={pending}>
            Create patient account
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
