import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/utils/cn';
import { humanize, initials } from '@/utils/format';
import { roleLabel } from '@/utils/status';
import { Avatar } from '@/components/ui/Display';
import { ChangePasswordDialog } from '@/features/auth/ChangePasswordDialog';
import { flattenNavigation } from './navigation';

function breadcrumbs(pathname: string, role: Parameters<typeof flattenNavigation>[0]) {
  const items = flattenNavigation(role);
  const match = items
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];

  if (!match) return [{ label: 'Workspace', key: 'root' }];

  const rest = pathname.slice(match.to.length).split('/').filter(Boolean);
  return [
    { label: match.label, key: match.to },
    ...rest.map((segment, index) => ({
      label: /^[0-9a-f-]{8,}$/i.test(segment) ? 'Details' : humanize(segment),
      key: `${index}-${segment}`,
    })),
  ];
}

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) return null;

  const crumbs = breadcrumbs(location.pathname, user.role);

  async function handleLogout() {
    setProfileOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Open navigation"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          </button>

          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex items-center gap-1.5 overflow-hidden text-sm">
              {crumbs.map((crumb, index) => (
                <li key={crumb.key} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 ? (
                    <span className="text-slate-300" aria-hidden="true">
                      /
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'truncate',
                      index === crumbs.length - 1
                        ? 'font-semibold text-slate-900'
                        : 'text-slate-500',
                    )}
                  >
                    {crumb.label}
                  </span>
                </li>
              ))}
            </ol>
          </nav>

          <div ref={wrapper} className="flex items-center gap-1.5">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  setProfileOpen(false);
                }}
                className="relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Notifications"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path
                    d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10.3 21a2 2 0 0 0 3.4 0"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
              {notificationsOpen ? (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      0 new
                    </span>
                  </div>
                  <div className="mt-3 rounded-xl bg-slate-50 p-4 text-center">
                    <p className="text-sm font-medium text-slate-700">You're all caught up</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Operational alerts will appear here when a notification feed is configured
                      for this workspace.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((value) => !value);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-2.5 rounded-xl p-1.5 pr-2 transition hover:bg-slate-100"
                aria-label="Account menu"
              >
                <Avatar
                  firstName={user.firstName}
                  lastName={user.lastName}
                  size="sm"
                  className="bg-gradient-to-br from-slate-700 to-slate-500"
                />
                <span className="hidden text-left sm:block">
                  <span className="block max-w-36 truncate text-sm font-semibold text-slate-800">
                    {user.firstName} {user.lastName}
                  </span>
                  <span className="block text-[11px] text-slate-500">{roleLabel(user.role)}</span>
                </span>
                <svg viewBox="0 0 24 24" className="hidden h-4 w-4 text-slate-400 sm:block" fill="none" aria-hidden="true">
                  <path
                    d="m6 9 6 6 6-6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>

              {profileOpen ? (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <Avatar firstName={user.firstName} lastName={user.lastName} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="truncate text-xs text-slate-500">{user.email ?? roleLabel(user.role)}</p>
                    </div>
                  </div>
                  <div className="my-1 h-px bg-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      setPasswordOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">
                      {initials(user.firstName, user.lastName)}
                    </span>
                    Change password
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                      <path
                        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}
