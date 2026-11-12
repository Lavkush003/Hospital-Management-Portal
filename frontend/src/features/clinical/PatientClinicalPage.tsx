import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ClinicalSummaryVisit } from '@/types/api';
import { clinicalApi } from '@/services/hms';
import { formatDate, formatDateTime, getAge, humanize } from '@/utils/format';
import { statusTone } from '@/utils/status';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Avatar } from '@/components/ui/Display';

function VisitSummary({ visit, open }: { visit: ClinicalSummaryVisit; open: boolean }) {
  const [expanded, setExpanded] = useState(open);
  const noteCount = visit.notes.length;
  const prescriptionCount = visit.prescriptions.length;
  const reportCount = visit.diagnosticReports.length;

  return (
    <div className="rounded-2xl border border-slate-200">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-900">{visit.visitNumber}</p>
            <Badge tone={statusTone(visit.status)} dot>
              {humanize(visit.status)}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">
            {formatDate(visit.startedAt)} · Dr. {visit.doctor.firstName} {visit.doctor.lastName} ·{' '}
            {visit.doctor.specialization}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
          <span>{noteCount} notes</span>
          <span>{prescriptionCount} Rx</span>
          <span>{reportCount} reports</span>
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          </svg>
        </div>
      </button>

      {expanded ? (
        <div className="space-y-5 border-t border-slate-100 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chief complaint</p>
              <p className="mt-1 text-sm text-slate-700">{visit.chiefComplaint ?? 'Not recorded'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Diagnosis</p>
              <p className="mt-1 text-sm text-slate-700">{visit.diagnosis ?? 'Not recorded'}</p>
            </div>
          </div>

          {visit.clinicalNotes ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clinical notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{visit.clinicalNotes}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['BP', visit.systolicBp !== null && visit.diastolicBp !== null ? `${visit.systolicBp}/${visit.diastolicBp}` : '—'],
              ['Heart rate', visit.heartRate !== null ? `${visit.heartRate} bpm` : '—'],
              ['Temperature', visit.temperatureC ? `${visit.temperatureC} °C` : '—'],
              ['SpO₂', visit.oxygenSaturation !== null ? `${visit.oxygenSaturation}%` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prescriptions</p>
              {visit.prescriptions.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">No prescriptions.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {visit.prescriptions.map((prescription) => (
                    <div key={prescription.id} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{prescription.prescriptionNumber}</p>
                        <Badge tone={statusTone(prescription.status)}>{humanize(prescription.status)}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">{formatDateTime(prescription.issuedAt)}</p>
                      <ul className="mt-2 space-y-1">
                        {prescription.items.map((item) => (
                          <li key={item.id} className="text-xs text-slate-600">
                            {item.medicationName} · {item.dosage} · {item.frequency} · {item.durationDays} days
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Diagnostic reports</p>
              {visit.diagnosticReports.length === 0 ? (
                <p className="mt-1 text-sm text-slate-500">No reports.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {visit.diagnosticReports.map((report) => (
                    <div key={report.id} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800">{report.testName}</p>
                        <Badge tone={statusTone(report.status)}>{humanize(report.status)}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {humanize(report.type)} · ordered {formatDate(report.orderedAt)}
                      </p>
                      {report.resultSummary ? (
                        <p className="mt-1 text-xs text-slate-600">{report.resultSummary}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Link to={`/clinician/visits/${visit.id}`}>
              <Button size="sm" variant="outline">
                Open full visit
              </Button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PatientClinicalPage() {
  const { patientId = '' } = useParams();
  const query = useQuery({
    queryKey: ['clinical-summary', patientId],
    queryFn: () => clinicalApi.summary(patientId),
    enabled: patientId !== '',
  });

  const summary = query.data;
  const visits = summary?.visits ?? [];
  const noteCount = visits.reduce((count, visit) => count + visit.notes.length, 0);
  const prescriptionCount = visits.reduce((count, visit) => count + visit.prescriptions.length, 0);
  const reportCount = visits.reduce((count, visit) => count + visit.diagnosticReports.length, 0);

  if (query.isError) {
    return (
      <Card>
        <ErrorState
          message={query.error instanceof Error ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Loading clinical record…</p>
      </Card>
    );
  }

  const { patient } = summary;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinical record"
        title={`${patient.firstName} ${patient.lastName}`}
        description={`${patient.patientNumber} · ${getAge(patient.dateOfBirth)} years · ${humanize(patient.gender)}`}
        actions={
          <Link to={`/clinician/visits?patientId=${patient.id}`}>
            <Button>Record a visit</Button>
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-4">
              <Avatar firstName={patient.firstName} lastName={patient.lastName} size="lg" />
              <div>
                <p className="text-lg font-semibold text-slate-950">
                  {patient.firstName} {patient.lastName}
                </p>
                <Badge tone={statusTone(patient.status)} dot className="mt-1">
                  {humanize(patient.status)}
                </Badge>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Patient number</dt>
                <dd className="font-medium text-slate-700">{patient.patientNumber}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Blood group</dt>
                <dd className="font-medium text-slate-700">{humanize(patient.bloodGroup)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Date of birth</dt>
                <dd className="font-medium text-slate-700">{formatDate(patient.dateOfBirth)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Allergies" description="Safety-critical patient information." />
            <p
              className={`mt-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                patient.allergies ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {patient.allergies || 'No known allergies recorded'}
            </p>
          </Card>

          <Card>
            <CardHeader title="Care summary" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ['Visits', visits.length],
                ['Notes', noteCount],
                ['Prescriptions', prescriptionCount],
                ['Reports', reportCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-xl font-semibold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Visit history"
            description="Clinical entries are grouped by visit. Expand a visit to review details."
          />
          {visits.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No clinical visits"
                description="A visit must be recorded before notes, prescriptions or reports can be added."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {visits.map((visit, index) => (
                <VisitSummary key={visit.id} visit={visit} open={index === 0} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
