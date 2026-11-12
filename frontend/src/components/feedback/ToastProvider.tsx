import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { ToastContext, type ToastInput, type ToastTone } from './toast-context';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        tone: input.tone ?? 'success',
      };
      setItems((current) => [...current, item]);
      window.setTimeout(() => remove(id), input.tone === 'error' ? 7000 : 4500);
    },
    [remove],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
          {items.map((item) => (
            <div
              key={item.id}
              role="status"
              className={cn(
                'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-white p-4 shadow-xl',
                item.tone === 'success'
                  ? 'border-emerald-200'
                  : item.tone === 'error'
                    ? 'border-rose-200'
                    : 'border-sky-200',
              )}
            >
              <span
                className={cn(
                  'mt-1 h-2 w-2 flex-shrink-0 rounded-full',
                  item.tone === 'success'
                    ? 'bg-emerald-500'
                    : item.tone === 'error'
                      ? 'bg-rose-500'
                      : 'bg-sky-500',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="text-slate-400 transition hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path
                    d="m6 6 12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
