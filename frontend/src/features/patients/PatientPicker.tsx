import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Patient } from '@/types/api';
import { patientsApi } from '@/services/hms';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Display';

export function PatientPicker({
  selected,
  onSelect,
}: {
  selected: Patient | null;
  onSelect: (patient: Patient | null) => void;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const results = useQuery({
    queryKey: ['patient-picker', debounced],
    queryFn: () => patientsApi.list({ search: debounced, page: 1, pageSize: 8 }),
    enabled: debounced.trim().length >= 2 && selected === null,
  });

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar firstName={selected.firstName} lastName={selected.lastName} size="sm" />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {selected.firstName} {selected.lastName}
            </p>
            <p className="text-xs text-slate-500">
              {selected.patientNumber} · {selected.phone ?? 'No phone'}
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onSelect(null)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder="Search patient by name, number or phone…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        autoComplete="off"
      />
      {debounced.trim().length >= 2 ? (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {results.isPending ? (
            <p className="px-3 py-2 text-sm text-slate-500">Searching…</p>
          ) : results.data?.patients.length ? (
            results.data.patients.map((patient) => (
              <button
                key={patient.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => {
                  onSelect(patient);
                  setSearch('');
                }}
              >
                <Avatar firstName={patient.firstName} lastName={patient.lastName} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {patient.firstName} {patient.lastName}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {patient.patientNumber} · {patient.phone ?? 'No phone'}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-slate-500">No matching patients.</p>
          )}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-slate-400">
          Type at least two characters to search patient records.
        </p>
      )}
    </div>
  );
}
