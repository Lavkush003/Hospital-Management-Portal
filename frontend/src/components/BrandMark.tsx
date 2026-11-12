export function BrandMark() {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-700 to-teal-500 text-white shadow-sm shadow-brand-900/20">
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 4v16M4 12h16" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-bold tracking-tight text-slate-950">Careflow</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Hospital management
        </span>
      </span>
    </span>
  );
}
