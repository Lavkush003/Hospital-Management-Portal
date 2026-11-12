import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '@/components/BrandMark';

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.02fr_0.98fr]">
      <section className="relative hidden overflow-hidden bg-[#063a47] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-36 -top-32 h-[520px] w-[520px] rounded-full border border-white/10" />
        <div className="absolute -right-16 -top-12 h-[360px] w-[360px] rounded-full border border-white/10" />
        <div className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-teal-400/10 blur-3xl" />
        <Link to="/login" className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-300 text-2xl font-bold text-teal-950">
            +
          </span>
          <span>
            <span className="block text-lg font-bold tracking-tight">Careflow</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-200/70">
              Hospital management
            </span>
          </span>
        </Link>

        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-200">
            {eyebrow}
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            {title}
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-teal-50/75">{description}</p>
          <div className="mt-10 flex items-center gap-3 text-xs text-teal-100/70">
            <span className="h-px w-9 bg-teal-300/70" /> Built for connected care teams
          </div>
        </div>

        <p className="relative text-xs text-teal-100/55">
          Careflow · Secure hospital operations
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className={wide ? 'w-full max-w-[540px]' : 'w-full max-w-[430px]'}>
          <div className="mb-9 lg:hidden">
            <BrandMark />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            Authorized staff only. Access and clinical activity are audited.
          </p>
        </div>
      </section>
    </main>
  );
}
