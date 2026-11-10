import { NavLink, Outlet } from 'react-router-dom';
import { BrandMark } from '@/components/BrandMark';
import { cn } from '@/utils/cn';

const navLinkClassName = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-brand-50 text-brand-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
  );

export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        className="sr-only z-50 m-3 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-0 focus:top-0"
        href="#main-content"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <NavLink
            aria-label="Hospital Management System home"
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
            to="/"
          >
            <BrandMark />
          </NavLink>

          <nav aria-label="Primary" className="ml-auto flex items-center gap-1">
            <NavLink className={navLinkClassName} end to="/">
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Home</span>
            </NavLink>
            <a
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              href="/#system-status"
            >
              Status
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1" id="main-content">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200/70 bg-white/60">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Hospital Management System foundation.</p>
          <p>React / Express / PostgreSQL</p>
        </div>
      </footer>
    </div>
  );
}
