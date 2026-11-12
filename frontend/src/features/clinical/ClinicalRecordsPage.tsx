import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Visit } from '@/types/api';
import { visitsApi } from '@/services/hms';
import { useAuth } from '@/features/auth/auth-context';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDate, formatDateTime, humanize } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { statusTone } from '@/utils/status';
import { NotesPanel, PrescriptionsPanel, ReportsPanel } from './ClinicalPanels';

type Mode = 'notes' | 'prescriptions' | 'reports';

const content = {
  notes: {
    title: 'Clinical notes',
    description: 'Review and add clinical notes for a patient visit.',
  },
  prescriptions: {
    title: 'Prescriptions',
    description: 'Review and issue medication prescriptions for a visit.',
  },
  reports: {
    title: 'Diagnostic reports',
    description: 'Review laboratory, imaging and pathology reports for a visit.',
  },
} as const;

export function ClinicalRecordsPage({ mode }: { mode: Mode }) {
  const { user } = useAuth();
  const canManage = user?.role === 'CLINICIAN' || user?.role === 'ADMIN';
  const [search, setSearch] = useState('');
  const [selectedVisitId, setVisitId] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ['visits', 'records', debouncedSearch],
    queryFn: () => visitsApi.list({ search: debouncedSearch || undefined, page: 1, pageSize: 50 }),
  });

  const visits = query.data?.visits ?? [];
  const visitId =
    selectedVisitId && visits.some((item) => item.id === selectedVisitId)
      ? selectedVisitId
      : (visits[0]?.id ?? '');
  const visit = visits.find((item) => item.id === visitId) ?? null;
  const meta = content[mode];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinical records"
        title={meta.title}
        description={meta.description}
        actions={
          visit ? (
            <Link to={`/clinician/visits/${visit.id}?tab=${mode}`}>
              <Button variant="outline">Open full visit</Button>
            </Link>
          ) : null
        }
      />

      <Card>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-end">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="records-search">
              Find visit
            </label>
            <Input
              id="records-search"
              placeholder="Search patient, visit or diagnosis"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="records-visit">
              Visit
            </label>
            <Select id="records-visit" value={visitId} onChange={(event) => setVisitId(event.target.value)}>
              {visits.map((item: Visit) => (
                <option key={item.id} value={item.id}>
                  {item.visitNumber} · {item.patient.firstName} {item.patient.lastName} · {formatDate(item.startedAt)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {query.isError ? (
        <Card>
          <ErrorState
            message={query.error instanceof Error ? query.error.message : undefined}
            onRetry={() => void query.refetch()}
          />
        </Card>
      ) : query.isPending ? (
        <Card>
          <p className="text-sm text-slate-500">Loading visits…</p>
        </Card>
      ) : !visit ? (
        <Card>
          <EmptyState title="No visits" description="Visits must be recorded before clinical entries can be added." />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Selected visit</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              {visit.patient.firstName} {visit.patient.lastName}
            </p>
            <p className="text-sm text-slate-500">{visit.patient.patientNumber}</p>
            <div className="mt-3">
              <Badge tone={statusTone(visit.status)} dot>
                {humanize(visit.status)}
              </Badge>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Visit</dt>
                <dd className="font-medium text-slate-700">{visit.visitNumber}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Doctor</dt>
                <dd className="text-right font-medium text-slate-700">
                  Dr. {visit.doctor.firstName} {visit.doctor.lastName}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Started</dt>
                <dd className="text-right font-medium text-slate-700">{formatDateTime(visit.startedAt)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Diagnosis</dt>
                <dd className="text-right font-medium text-slate-700">{visit.diagnosis ?? '—'}</dd>
              </div>
            </dl>
            <Link
              to={`/clinician/patients/${visit.patientId}`}
              className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline"
            >
              Patient record
            </Link>
          </Card>

          <Card>
            {mode === 'notes' ? (
              <NotesPanel visitId={visit.id} patientId={visit.patientId} canManage={canManage} />
            ) : mode === 'prescriptions' ? (
              <PrescriptionsPanel visitId={visit.id} patientId={visit.patientId} canManage={canManage} />
            ) : (
              <ReportsPanel visitId={visit.id} patientId={visit.patientId} canManage={canManage} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
