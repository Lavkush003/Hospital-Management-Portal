import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { AuthShell } from '@/features/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { FormError } from '@/components/feedback/FormBits';
import { homePathFor } from '@/components/layout/navigation';

export function LoginPage() {
  const { user, login, loading, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500" role="status">
        Restoring your secure session…
      </div>
    );
  }

  if (user) {
    const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return <Navigate replace to={nextPath ?? homePathFor(user.role)} />;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage('');

    if (!email.trim()) {
      setMessage('Enter your email address.');
      return;
    }
    if (!password) {
      setMessage('Enter your password.');
      return;
    }

    try {
      setPending(true);
      const session = await login(email.trim(), password);
      const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from
        ?.pathname;
      navigate(nextPath ?? homePathFor(session.role), { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      description="Use your hospital account to coordinate care, appointments and operations."
      footer={
        <p className="text-center text-sm text-slate-600">
          New patient?{' '}
          <Link className="font-semibold text-brand-700 hover:underline" to="/register">
            Create a patient account
          </Link>
        </p>
      }
    >
      <form className="space-y-4" noValidate onSubmit={submit}>
        <Field label="Email address" htmlFor="login-email" required>
          <Input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder="you@hospital.org"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="login-password" required>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {message ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {message}
          </p>
        ) : null}
        <FormError error={error} />
        {authError && !error ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {authError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" size="lg" loading={pending}>
          Sign in securely
        </Button>
      </form>
    </AuthShell>
  );
}
