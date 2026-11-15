import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, CalendarCheck2, LockKeyhole, Mail, ShieldCheck, Stethoscope, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';
import { Button, Field, Input } from '../components/ui';

const demoAccounts = [
  { label: 'Administrator', email: 'admin@hospital.demo', icon: ShieldCheck },
  { label: 'Receptionist', email: 'reception@hospital.demo', icon: Users },
  { label: 'Doctor', email: 'doctor@hospital.demo', icon: Stethoscope },
];

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  const onChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(form);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500 shadow-lg shadow-teal-500/30">
            <Activity size={22} />
          </span>
          <div>
            <p className="text-xl font-bold tracking-tight">MediCore</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-teal-400">Hospital Operating System</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-400">Care, coordinated</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">
            One secure workspace for every step of the patient journey.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-400">
            Register patients, book conflict-free appointments, document consultations, issue prescriptions and reconcile billing with a complete audit trail.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: CalendarCheck2, label: 'Smart scheduling' },
              { icon: Stethoscope, label: 'Clinical records' },
              { icon: ShieldCheck, label: 'Immutable audit' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <item.icon size={18} className="text-teal-400" />
                <p className="mt-3 text-xs font-semibold text-slate-200">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-500">Role-based access · Encrypted credentials · Full activity traceability</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
                <Activity size={20} />
              </span>
              <div>
                <p className="text-lg font-bold text-slate-900">MediCore</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-600">Hospital OS</p>
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in with your hospital account to continue.</p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <Field label="Email address" required>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input name="email" type="email" autoComplete="email" required value={form.email} onChange={onChange} placeholder="you@hospital.demo" className="pl-9" />
              </div>
            </Field>
            <Field label="Password" required>
              <div className="relative">
                <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input name="password" type="password" autoComplete="current-password" required value={form.password} onChange={onChange} placeholder="Enter your password" className="pl-9" />
              </div>
            </Field>

            {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

            <Button type="submit" loading={submitting} className="w-full" size="lg">
              Sign in <ArrowRight size={16} />
            </Button>
          </form>

          <div className="mt-7 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Demo accounts</p>
            <div className="mt-3 grid gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => setForm({ email: account.email, password: 'HospitalPass123!' })}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-left text-sm text-slate-600 transition hover:border-teal-200 hover:bg-teal-50/50"
                >
                  <account.icon size={15} className="text-teal-600" />
                  <span className="flex-1 font-medium">{account.label}</span>
                  <span className="text-[11px] text-slate-400">{account.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-400">Password for demo accounts: <span className="font-semibold text-slate-600">HospitalPass123!</span></p>
          </div>
        </div>
      </section>
    </div>
  );
}
