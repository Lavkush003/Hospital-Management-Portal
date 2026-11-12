import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/services/api';

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {errorMessage(error)}
    </div>
  );
}

export function FormActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2 pt-2', className)}>
      {children}
    </div>
  );
}

export function DetailRow({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-4', className)}>
      <dt className="w-40 flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="text-sm text-slate-700">{value ?? '—'}</dd>
    </div>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      Reload
    </Button>
  );
}
