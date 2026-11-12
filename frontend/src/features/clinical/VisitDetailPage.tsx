import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Visit, VisitStatus } from '@/types/api';
import { visitsApi, type UpdateVisitInput, type VisitInput } from '@/services/hms';
import { useAuth } from '@/features/auth/auth-context';
import { useToast } from '@/components/feedback/toast-context';
import { errorMessage } from '@/services/api';
import { formatDate, formatDateTime, getAge, humanize } from '@/utils/format';
import { canTransitionVisit, statusTone } from '@/utils/status';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Field, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { ErrorState } from '@/components/ui/States';
import { DetailRow } from '@/components/feedback/FormBits';
import { VisitForm } from './VisitForm';
import { NotesPanel, PrescriptionsPanel, ReportsPanel } from './ClinicalPanels';

const tabs = [
  { key: 'notes', label: 'Clinical notes' },
  { key: 'prescriptions', label: 'Prescriptions' },
  { key: 'reports', label: 'Diagnostic reports' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

function VitalsGrid({ visit }: { visit: Visit }) {
  const items = [
    { label: 'Height', value: visit.heightCm ? `${visit.heightCm} cm` : '—' },
    { label: 'Weight', value: visit.weightKg ? `${visit.weightKg} kg` : '—' },
    { label: 'Temperature', value: visit.temperatureC ? `${visit.temperatureC} °C` : '—' },
    {
      label: 'Blood pressure',
      value:
        visit.systolicBp !== null && visit.diastolicBp !== null
          ? `${visit.systolicBp}/${visit.diastolicBp} mmHg`
          : '—',
    },
    { label: 'Heart rate', value: visit.heartRate !== null ? `${visit.heartRate} bpm` : '—' },
    {
      label: 'Respiratory rate',
      value: visit.respiratoryRate !== null ? `${visit.respiratoryRate}/min` : '—',
    },
    {
      label: 'Oxygen saturation',
      value: visit.oxygenSaturation !== null ? `${visit.oxygenSaturation}%` : '—',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function VisitDetailPage() {
  const { visitId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = user?.role === 'CLINICIAN' || user?.role === 'ADMIN';

  const rawTab = searchParams.get('tab');
  const tab: TabKey = tabs.some((item) => item.key === rawTab) ? (rawTab as TabKey) : 'notes';

  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<unknown>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const query = useQuery({
    queryKey: ['visit', visitId],
    queryFn: () => visitsApi.find(visitId),
    enabled: visitId !== '',
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['visit', visitId] });
    void queryClient.invalidateQueries({ queryKey: ['visits'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const updateMutation = useMutation({
    mutationFn: (input: UpdateVisitInput) => visitsApi.update(visitId, input),
    onSuccess: () => {
      toast({ title: 'Visit updated' });
      setEditing(false);
      setEditError(null);
      refresh();
    },
    onError: (error) => setEditError(error),
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: VisitStatus; reason?: string }) =>
      visitsApi.setStatus(visitId, status, reason),
    onSuccess: (visit) => {
      toast({ title: 'Visit updated', description: humanize(visit.status) });
      setCancelling(false);
      setCancelReason('');
      refresh();
    },
    onError: (error) =>
      toast({ title: 'Could not update visit', description: errorMessage(error), tone: 'error' }),
  });

  const visit = query.data;

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

  if (!visit) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Loading visit…</p>
      </Card>
    );
  }

  const canStart = canManage && canTransitionVisit(visit.status, 'IN_PROGRESS');
  const canComplete = canManage && canTransitionVisit(visit.status, 'COMPLETED');
  const canCancel = canManage && canTransitionVisit(visit.status, 'CANCELLED');

  return (
    <div className="space-y-6">
      <div>
        <Link to="/clinician/visits" className="text-sm font-medium text-brand-700 hover:underline">
          ← Back to visits
        </Link>
      </div>

      <PageHeader
        eyebrow={`Visit ${visit.visitNumber}`}
        title={`${visit.patient.firstName} ${visit.patient.lastName}`}
        description={`Started ${formatDateTime(visit.startedAt)} · Dr. ${visit.doctor.firstName} ${visit.doctor.lastName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(visit.status)} dot>
              {humanize(visit.status)}
            </Badge>
            {canManage ? (
              <Button variant="outline" onClick={() => {
                setEditError(null);
                setEditing(true);
              }}>
                Edit visit
              </Button>
            ) : null}
            {canStart ? (
              <Button
                loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ status: 'IN_PROGRESS' })}
              >
                Start visit
              </Button>
            ) : null}
            {canComplete ? (
              <Button
                loading={statusMutation.isPending}
                onClick={() => statusMutation.mutate({ status: 'COMPLETED' })}
              >
                Complete visit
              </Button>
            ) : null}
            {canCancel ? (
              <Button variant="danger" onClick={() => {
                setCancelReason('');
                setCancelling(true);
              }}>
                Cancel visit
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Clinical assessment" description="Recorded findings and plan." />
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chief complaint</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {visit.chiefComplaint ?? 'Not recorded'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Diagnosis</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {visit.diagnosis ?? 'Not recorded'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clinical notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {visit.clinicalNotes ?? 'Not recorded'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Follow-up</p>
                <p className="mt-1 text-sm text-slate-700">
                  {visit.followUpAt ? formatDate(visit.followUpAt) : 'No follow-up scheduled'}
                  {visit.followUpNotes ? ` · ${visit.followUpNotes}` : ''}
                </p>
              </div>
            </div>
          </Card>

          <Card padding="none">
            <div className="flex flex-wrap gap-1 border-b border-slate-100 p-2">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSearchParams({ tab: item.key })}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    tab === item.key
                      ? 'bg-brand-50 text-brand-800'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="p-4 sm:p-5">
              {tab === 'notes' ? (
                <NotesPanel visitId={visit.id} patientId={visit.patientId} canManage={canManage} />
              ) : tab === 'prescriptions' ? (
                <PrescriptionsPanel visitId={visit.id} patientId={visit.patientId} canManage={canManage} />
              ) : (
                <ReportsPanel visitId={visit.id} patientId={visit.patientId} canManage={canManage} />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Patient" />
            <div className="mt-4 space-y-1">
              <p className="text-lg font-semibold text-slate-950">
                {visit.patient.firstName} {visit.patient.lastName}
              </p>
              <p className="text-sm text-slate-500">
                {visit.patient.patientNumber} · {getAge(visit.patient.dateOfBirth)} years
              </p>
              <p className="text-sm text-slate-500">
                {humanize(visit.patient.gender)} · {humanize(visit.patient.bloodGroup)}
              </p>
              <p className="text-sm text-slate-500">{visit.patient.phone ?? 'No phone'}</p>
            </div>
            <div className="mt-4">
              <Link
                to={`/clinician/patients/${visit.patientId}`}
                className="text-sm font-semibold text-brand-700 hover:underline"
              >
                Open patient clinical record
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Vitals" />
            <div className="mt-4">
              <VitalsGrid visit={visit} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Visit details" />
            <dl className="mt-3 divide-y divide-slate-100">
              <DetailRow label="Visit number" value={visit.visitNumber} />
              <DetailRow label="Doctor" value={`Dr. ${visit.doctor.firstName} ${visit.doctor.lastName}`} />
              <DetailRow label="Department" value={visit.doctor.department.name} />
              <DetailRow label="Started" value={formatDateTime(visit.startedAt)} />
              <DetailRow label="Ended" value={visit.endedAt ? formatDateTime(visit.endedAt) : '—'} />
              {visit.appointment ? (
                <DetailRow label="Appointment" value={visit.appointment.appointmentNumber} />
              ) : null}
            </dl>
          </Card>
        </div>
      </div>

      <Modal
        open={editing}
        onClose={() => {
          setEditing(false);
          setEditError(null);
        }}
        title="Edit visit"
        description="Update the clinical assessment and vitals."
        size="xl"
      >
        {editing ? (
          <VisitForm
            visit={visit}
            pending={updateMutation.isPending}
            error={editError}
            onSubmit={(input: VisitInput) =>
              updateMutation.mutate({
                chiefComplaint: input.chiefComplaint,
                diagnosis: input.diagnosis,
                clinicalNotes: input.clinicalNotes,
                followUpAt: input.followUpAt ?? null,
                followUpNotes: input.followUpNotes,
                vitals: input.vitals,
              })
            }
            onCancel={() => {
              setEditing(false);
              setEditError(null);
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={cancelling}
        title="Cancel visit?"
        description="The visit will be marked cancelled. Provide a reason for the clinical record."
        confirmLabel="Cancel visit"
        loading={statusMutation.isPending}
        onConfirm={() => {
          if (cancelReason.trim().length < 3) {
            toast({ title: 'Please provide a cancellation reason', tone: 'info' });
            return;
          }
          statusMutation.mutate({ status: 'CANCELLED', reason: cancelReason.trim() });
        }}
        onClose={() => {
          if (!statusMutation.isPending) {
            setCancelling(false);
            setCancelReason('');
          }
        }}
      >
        <Field label="Cancellation reason" required>
          <Textarea rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
        </Field>
      </ConfirmDialog>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => navigate('/clinician/visits')}>
          Back to visits
        </Button>
      </div>
    </div>
  );
}
