import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClinicalNote,
  DiagnosticReport,
  DiagnosticReportType,
  Prescription,
} from '@/types/api';
import {
  notesApi,
  prescriptionsApi,
  reportsApi,
  type PrescriptionInput,
  type PrescriptionItemInput,
  type ReportInput,
} from '@/services/hms';
import { errorMessage } from '@/services/api';
import { useToast } from '@/components/feedback/toast-context';
import { formatDate, formatDateTime, humanize } from '@/utils/format';
import { statusTone } from '@/utils/status';
import { toDateTimeLocal, fromDateTimeLocal } from '@/utils/date';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { FormError } from '@/components/feedback/FormBits';

function useClinicalRefresh(visitId: string, patientId?: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['notes', visitId] });
    void queryClient.invalidateQueries({ queryKey: ['prescriptions', visitId] });
    void queryClient.invalidateQueries({ queryKey: ['reports', visitId] });
    void queryClient.invalidateQueries({ queryKey: ['visit', visitId] });
    if (patientId) void queryClient.invalidateQueries({ queryKey: ['clinical-summary', patientId] });
  };
}

function NoteEditor({
  note,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  note?: ClinicalNote | null;
  pending: boolean;
  error: unknown;
  onSubmit: (content: string, editReason?: string) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(note?.content ?? '');
  const [editReason, setEditReason] = useState('');
  const [message, setMessage] = useState('');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!content.trim()) {
      setMessage('Clinical note content is required.');
      return;
    }
    onSubmit(content.trim(), editReason.trim() || undefined);
  }

  return (
    <form className="space-y-4" noValidate onSubmit={submit}>
      <Field label="Clinical note" required>
        <Textarea
          rows={8}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Document assessment, findings, plan and follow-up."
        />
      </Field>
      {note ? (
        <Field label="Reason for edit">
          <Input value={editReason} onChange={(event) => setEditReason(event.target.value)} />
        </Field>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
      <FormError error={error} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {note ? 'Save note' : 'Add note'}
        </Button>
      </div>
    </form>
  );
}

export function NotesPanel({
  visitId,
  patientId,
  canManage,
}: {
  visitId: string;
  patientId?: string;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const refresh = useClinicalRefresh(visitId, patientId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClinicalNote | null>(null);
  const [error, setError] = useState<unknown>(null);

  const query = useQuery({
    queryKey: ['notes', visitId],
    queryFn: () => notesApi.list(visitId),
  });

  const createMutation = useMutation({
    mutationFn: (content: string) => notesApi.create(visitId, content),
    onSuccess: () => {
      toast({ title: 'Clinical note added' });
      setOpen(false);
      setError(null);
      refresh();
    },
    onError: (value) => setError(value),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, content, editReason }: { id: string; content: string; editReason?: string }) =>
      notesApi.update(visitId, id, { content, editReason }),
    onSuccess: () => {
      toast({ title: 'Clinical note updated' });
      setEditing(null);
      setError(null);
      refresh();
    },
    onError: (value) => setError(value),
  });

  const notes = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {notes.length} note{notes.length === 1 ? '' : 's'} on this visit.
        </p>
        {canManage ? (
          <Button size="sm" onClick={() => {
            setError(null);
            setOpen(true);
          }}>
            Add note
          </Button>
        ) : null}
      </div>

      {query.isError ? (
        <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <p className="text-sm text-slate-500">Loading notes…</p>
      ) : notes.length === 0 ? (
        <EmptyState title="No clinical notes" description="Clinical notes added to this visit will appear here." />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {note.author ? `${note.author.firstName} ${note.author.lastName}` : 'Clinical author'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(note.createdAt)}
                    {note.updatedAt !== note.createdAt ? ` · updated ${formatDateTime(note.updatedAt)}` : ''}
                    {note.revisionCount ? ` · ${note.revisionCount} revisions` : ''}
                  </p>
                </div>
                {canManage ? (
                  <Button size="sm" variant="ghost" onClick={() => {
                    setError(null);
                    setEditing(note);
                  }}>
                    Edit
                  </Button>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.content}</p>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        title="Add clinical note"
        description="Record assessment, findings and the care plan."
        size="lg"
      >
        {open ? (
          <NoteEditor
            pending={createMutation.isPending}
            error={error}
            onSubmit={(content) => createMutation.mutate(content)}
            onCancel={() => {
              setOpen(false);
              setError(null);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={editing !== null}
        onClose={() => {
          setEditing(null);
          setError(null);
        }}
        title="Edit clinical note"
        description="Editing creates a revision so the original content remains auditable."
        size="lg"
      >
        {editing ? (
          <NoteEditor
            note={editing}
            pending={updateMutation.isPending}
            error={error}
            onSubmit={(content, editReason) =>
              updateMutation.mutate({ id: editing.id, content, editReason })
            }
            onCancel={() => {
              setEditing(null);
              setError(null);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

interface PrescriptionItemValues {
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: string;
  quantity: string;
  instructions: string;
}

function emptyPrescriptionItem(): PrescriptionItemValues {
  return {
    medicationName: '',
    dosage: '',
    frequency: '',
    durationDays: '7',
    quantity: '1',
    instructions: '',
  };
}

function PrescriptionEditor({
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  error: unknown;
  onSubmit: (input: PrescriptionInput) => void;
  onCancel: () => void;
}) {
  const [items, setItems] = useState<PrescriptionItemValues[]>([emptyPrescriptionItem()]);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  function updateItem(index: number, key: keyof PrescriptionItemValues, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (items.some((item) => !item.medicationName.trim() || !item.dosage.trim() || !item.frequency.trim())) {
      setMessage('Medication, dosage and frequency are required for every item.');
      return;
    }
    const payload: PrescriptionItemInput[] = items.map((item) => ({
      medicationName: item.medicationName.trim(),
      dosage: item.dosage.trim(),
      frequency: item.frequency.trim(),
      durationDays: Math.max(1, Math.floor(Number(item.durationDays) || 1)),
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      instructions: item.instructions.trim() || undefined,
    }));
    onSubmit({ items: payload, notes: notes.trim() || undefined });
  }

  return (
    <form className="space-y-5" noValidate onSubmit={submit}>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Medication {index + 1}
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={items.length === 1}
                className="text-red-600 hover:bg-red-50"
                onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              >
                Remove
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Medication" required>
                <Input
                  value={item.medicationName}
                  onChange={(event) => updateItem(index, 'medicationName', event.target.value)}
                />
              </Field>
              <Field label="Dosage" required>
                <Input
                  value={item.dosage}
                  onChange={(event) => updateItem(index, 'dosage', event.target.value)}
                  placeholder="e.g. 500 mg"
                />
              </Field>
              <Field label="Frequency" required>
                <Input
                  value={item.frequency}
                  onChange={(event) => updateItem(index, 'frequency', event.target.value)}
                  placeholder="e.g. twice daily"
                />
              </Field>
              <Field label="Duration (days)" required>
                <Input
                  type="number"
                  min="1"
                  value={item.durationDays}
                  onChange={(event) => updateItem(index, 'durationDays', event.target.value)}
                />
              </Field>
              <Field label="Quantity" required>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                />
              </Field>
              <Field label="Instructions">
                <Input
                  value={item.instructions}
                  onChange={(event) => updateItem(index, 'instructions', event.target.value)}
                  placeholder="e.g. after food"
                />
              </Field>
            </div>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setItems((current) => [...current, emptyPrescriptionItem()])}
        >
          Add medication
        </Button>
      </div>
      <Field label="Prescription notes">
        <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
      <FormError error={error} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Issue prescription
        </Button>
      </div>
    </form>
  );
}

export function PrescriptionsPanel({
  visitId,
  patientId,
  canManage,
}: {
  visitId: string;
  patientId?: string;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const refresh = useClinicalRefresh(visitId, patientId);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [cancelTarget, setCancelTarget] = useState<Prescription | null>(null);
  const [reason, setReason] = useState('');

  const query = useQuery({
    queryKey: ['prescriptions', visitId],
    queryFn: () => prescriptionsApi.list(visitId),
  });

  const createMutation = useMutation({
    mutationFn: (input: PrescriptionInput) => prescriptionsApi.create(visitId, input),
    onSuccess: () => {
      toast({ title: 'Prescription issued' });
      setOpen(false);
      setError(null);
      refresh();
    },
    onError: (value) => setError(value),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason: value }: { id: string; status: 'DISPENSED' | 'CANCELLED'; reason?: string }) =>
      prescriptionsApi.setStatus(visitId, id, status, value),
    onSuccess: (prescription) => {
      toast({ title: 'Prescription updated', description: humanize(prescription.status) });
      setCancelTarget(null);
      setReason('');
      refresh();
    },
    onError: (value) =>
      toast({ title: 'Could not update prescription', description: errorMessage(value), tone: 'error' }),
  });

  const prescriptions = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {prescriptions.length} prescription{prescriptions.length === 1 ? '' : 's'} on this visit.
        </p>
        {canManage ? (
          <Button size="sm" onClick={() => {
            setError(null);
            setOpen(true);
          }}>
            New prescription
          </Button>
        ) : null}
      </div>

      {query.isError ? (
        <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <p className="text-sm text-slate-500">Loading prescriptions…</p>
      ) : prescriptions.length === 0 ? (
        <EmptyState title="No prescriptions" description="Medication orders for this visit will appear here." />
      ) : (
        <ul className="space-y-3">
          {prescriptions.map((prescription) => (
            <li key={prescription.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{prescription.prescriptionNumber}</p>
                  <p className="text-xs text-slate-500">
                    Issued {formatDateTime(prescription.issuedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(prescription.status)}>{humanize(prescription.status)}</Badge>
                  {canManage && prescription.status === 'ISSUED' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        loading={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ id: prescription.id, status: 'DISPENSED' })}
                      >
                        Dispense
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setReason('');
                          setCancelTarget(prescription);
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {prescription.items.map((item) => (
                  <li key={item.id} className="py-2 text-sm">
                    <p className="font-medium text-slate-800">
                      {item.medicationName} · {item.dosage}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.frequency} for {item.durationDays} days · quantity {item.quantity}
                      {item.instructions ? ` · ${item.instructions}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
              {prescription.notes ? (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {prescription.notes}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        title="Issue prescription"
        description="Add one or more medications to this visit."
        size="xl"
      >
        {open ? (
          <PrescriptionEditor
            pending={createMutation.isPending}
            error={error}
            onSubmit={(input) => createMutation.mutate(input)}
            onCancel={() => {
              setOpen(false);
              setError(null);
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel prescription?"
        description={
          cancelTarget
            ? `${cancelTarget.prescriptionNumber} will be cancelled. Provide a reason for the clinical record.`
            : ''
        }
        confirmLabel="Cancel prescription"
        loading={statusMutation.isPending}
        onConfirm={() => {
          if (!cancelTarget) return;
          if (reason.trim().length < 3) {
            toast({ title: 'Please provide a cancellation reason', tone: 'info' });
            return;
          }
          statusMutation.mutate({ id: cancelTarget.id, status: 'CANCELLED', reason: reason.trim() });
        }}
        onClose={() => {
          if (!statusMutation.isPending) {
            setCancelTarget(null);
            setReason('');
          }
        }}
      >
        <Field label="Cancellation reason" required>
          <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </ConfirmDialog>
    </div>
  );
}

function ReportEditor({
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  error: unknown;
  onSubmit: (input: ReportInput) => void;
  onCancel: () => void;
}) {
  const [testName, setTestName] = useState('');
  const [type, setType] = useState<DiagnosticReportType>('LABORATORY');
  const [orderedAt, setOrderedAt] = useState(toDateTimeLocal(new Date()));
  const [resultSummary, setResultSummary] = useState('');
  const [resultDetails, setResultDetails] = useState('');
  const [message, setMessage] = useState('');

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!testName.trim()) {
      setMessage('Test name is required.');
      return;
    }
    const ordered = fromDateTimeLocal(orderedAt);
    if (!ordered) {
      setMessage('Choose a valid ordered date/time.');
      return;
    }
    onSubmit({
      testName: testName.trim(),
      type,
      orderedAt: ordered.toISOString(),
      resultSummary: resultSummary.trim() || undefined,
      resultDetails: resultDetails.trim() || undefined,
    });
  }

  return (
    <form className="space-y-4" noValidate onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Test name" required>
          <Input value={testName} onChange={(event) => setTestName(event.target.value)} />
        </Field>
        <Field label="Type" required>
          <Select value={type} onChange={(event) => setType(event.target.value as DiagnosticReportType)}>
            <option value="LABORATORY">Laboratory</option>
            <option value="IMAGING">Imaging</option>
            <option value="PATHOLOGY">Pathology</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Ordered at">
          <Input type="datetime-local" value={orderedAt} onChange={(event) => setOrderedAt(event.target.value)} />
        </Field>
      </div>
      <Field label="Result summary">
        <Textarea rows={2} value={resultSummary} onChange={(event) => setResultSummary(event.target.value)} />
      </Field>
      <Field label="Result details">
        <Textarea rows={4} value={resultDetails} onChange={(event) => setResultDetails(event.target.value)} />
      </Field>
      {message ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </p>
      ) : null}
      <FormError error={error} />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          Add report
        </Button>
      </div>
    </form>
  );
}

export function ReportsPanel({
  visitId,
  patientId,
  canManage,
}: {
  visitId: string;
  patientId?: string;
  canManage: boolean;
}) {
  const { toast } = useToast();
  const refresh = useClinicalRefresh(visitId, patientId);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const query = useQuery({
    queryKey: ['reports', visitId],
    queryFn: () => reportsApi.list(visitId),
  });

  const createMutation = useMutation({
    mutationFn: (input: ReportInput) => reportsApi.create(visitId, input),
    onSuccess: () => {
      toast({ title: 'Diagnostic report added' });
      setOpen(false);
      setError(null);
      refresh();
    },
    onError: (value) => setError(value),
  });

  const statusMutation = useMutation({
    mutationFn: ({ report, status }: { report: DiagnosticReport; status: DiagnosticReport['status'] }) =>
      reportsApi.update(visitId, report.id, { status }),
    onSuccess: () => {
      toast({ title: 'Report status updated' });
      refresh();
    },
    onError: (value) =>
      toast({ title: 'Could not update report', description: errorMessage(value), tone: 'error' }),
  });

  const reports = query.data ?? [];
  const nextStatuses = (report: DiagnosticReport): DiagnosticReport['status'][] => {
    if (report.status === 'ORDERED') return ['COLLECTED', 'CANCELLED'];
    if (report.status === 'COLLECTED') return ['PROCESSING', 'CANCELLED'];
    if (report.status === 'PROCESSING') return ['COMPLETED', 'CANCELLED'];
    return [];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {reports.length} diagnostic report{reports.length === 1 ? '' : 's'} on this visit.
        </p>
        {canManage ? (
          <Button size="sm" onClick={() => {
            setError(null);
            setOpen(true);
          }}>
            Add report
          </Button>
        ) : null}
      </div>

      {query.isError ? (
        <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <p className="text-sm text-slate-500">Loading reports…</p>
      ) : reports.length === 0 ? (
        <EmptyState title="No diagnostic reports" description="Laboratory and imaging reports will appear here." />
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{report.testName}</p>
                  <p className="text-xs text-slate-500">
                    {humanize(report.type)} · ordered {formatDate(report.orderedAt)}
                    {report.completedAt ? ` · completed ${formatDate(report.completedAt)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(report.status)}>{humanize(report.status)}</Badge>
                  {canManage
                    ? nextStatuses(report).map((next) => (
                        <Button
                          key={next}
                          size="sm"
                          variant={next === 'CANCELLED' ? 'ghost' : 'outline'}
                          className={next === 'CANCELLED' ? 'text-red-600 hover:bg-red-50' : ''}
                          loading={statusMutation.isPending}
                          onClick={() => statusMutation.mutate({ report, status: next })}
                        >
                          {humanize(next)}
                        </Button>
                      ))
                    : null}
                </div>
              </div>
              {report.resultSummary ? (
                <p className="mt-3 text-sm text-slate-700">{report.resultSummary}</p>
              ) : null}
              {report.resultDetails ? (
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {report.resultDetails}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        title="Add diagnostic report"
        description="Record a laboratory, imaging or pathology report for this visit."
        size="lg"
      >
        {open ? (
          <ReportEditor
            pending={createMutation.isPending}
            error={error}
            onSubmit={(input) => createMutation.mutate(input)}
            onCancel={() => {
              setOpen(false);
              setError(null);
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}
