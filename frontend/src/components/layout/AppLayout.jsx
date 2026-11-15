import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  FileHeart,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui';
import { ROLE_LABELS } from '../../lib/constants';
import { cn } from '../../lib/utils';

const navSections = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] }],
  },
  {
    label: 'Front Office',
    items: [
      { to: '/patients', label: 'Patients', icon: Users, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
      { to: '/appointments', label: 'Appointments', icon: CalendarDays, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
      { to: '/billing', label: 'Billing & Payments', icon: ReceiptText, roles: ['ADMIN', 'RECEPTIONIST'] },
    ],
  },
  {
    label: 'Clinical',
    items: [
      { to: '/encounters', label: 'Encounters', icon: HeartPulse, roles: ['ADMIN', 'DOCTOR'] },
      { to: '/prescriptions', label: 'Prescriptions', icon: Pill, roles: ['ADMIN', 'DOCTOR'] },
      { to: '/diagnostic-reports', label: 'Diagnostic Reports', icon: FileHeart, roles: ['ADMIN', 'DOCTOR'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/doctors', label: 'Doctors', icon: Stethoscope, roles: ['ADMIN', 'RECEPTIONIST'] },
      { to: '/departments', label: 'Departments', icon: Building2, roles: ['ADMIN', 'RECEPTIONIST'] },
      { to: '/schedules', label: 'Doctor Schedules', icon: CalendarDays, roles: ['ADMIN'] },
      { to: '/staff', label: 'Staff Accounts', icon: UserCog, roles: ['ADMIN'] },
      { to: '/reports', label: 'Analytics', icon: BarChart3, roles: ['ADMIN'] },
      { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, roles: ['ADMIN'] },
    ],
  },
];

const pageTitles = {
  '/': 'Dashboard',
  '/patients': 'Patient Registry',
  '/appointments': 'Appointments',
  '/billing': 'Billing & Payments',
  '/encounters': 'Clinical Encounters',
  '/prescriptions': 'Prescriptions',
  '/diagnostic-reports': 'Diagnostic Reports',
  '/doctors': 'Doctors',
  '/departments': 'Departments',
  '/schedules': 'Doctor Schedules',
  '/staff': 'Staff Accounts',
  '/reports': 'Operational Analytics',
  '/audit-logs': 'Security Audit Logs',
  '/profile': 'My Profile',
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const currentTitle = location.pathname.startsWith('/patients/')
    ? 'Patient Record'
    : pageTitles[location.pathname] || 'MediCore HMS';

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-950 text-slate-300 transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <NavLink to="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-white shadow-lg shadow-teal-500/30">
              <Activity size={20} />
            </span>
            <span>
              <span className="block text-base font-bold tracking-tight text-white">MediCore</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400">Hospital OS</span>
            </span>
          </NavLink>
          <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navSections.map((section) => {
            const items = section.items.filter((item) => item.roles.includes(user.role));
            if (!items.length) return null;
            return (
              <div key={section.label}>
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{section.label}</p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                            isActive ? 'bg-teal-500/15 text-teal-300' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                          )
                        }
                      >
                        <Icon size={17} />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <NavLink
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/5"
          >
            <Avatar firstName={user.firstName} lastName={user.lastName} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{user.firstName} {user.lastName}</span>
              <span className="block truncate text-[11px] text-slate-400">{ROLE_LABELS[user.role]}</span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={onLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{currentTitle}</p>
            <p className="hidden text-xs text-slate-400 sm:block">Secure clinical operations workspace</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:flex">
            <ShieldCheck size={14} /> {ROLE_LABELS[user.role]}
          </div>
          <NavLink to="/profile" className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-sm">
            <Avatar firstName={user.firstName} lastName={user.lastName} size="sm" />
            <span className="hidden text-xs font-semibold text-slate-700 sm:block">{user.firstName}</span>
          </NavLink>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
