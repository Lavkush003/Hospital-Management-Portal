import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Patient, Visit } from '@/types/api';
import { endOfDay, fromDateInput, toDateInput } from '@/utils/date';
import { patientsApi, type VisitInput } from '@/services/hms';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Input';
import { FormError } from '@/components/feedback/FormBits';
import { PatientPicker } from '@/features/patients/PatientPicker';

interface Values {
  chiefComplaint: string;
  diagnosis: string;
  clinicalNotes: string;
  followUpAt: string;
  followUpNotes: string;
  heightCm: string;
  weightKg: string;
  temperatureC: string;
  systolicBp: string;
  diastolicBp: string;
  heartRate: string;
  respiratoryRate: string;
  oxygenSaturation: string;
}

function valuesFor(visit?: Visit | null): Values {
  return {
    chiefComplaint: visit?.chiefComplaint ?? '',
    diagnosis: visit?.diagnosis ?? '',
    clinicalNotes: visit?.clinicalNotes ?? '',
    followUpAt: visit?.followUpAt ? toDateInput(new Date(visit.followUpAt)) : '',
    followUpNotes: visit?.followUpNotes ?? '',
    heightCm: visit?.heightCm ?? '',
    weightKg: visit?.weightKg ?? '',
    temperatureC: visit?.temperatureC ?? '',
    systolicBp: visit?.systolicBp !== null && visit?.systolicBp !== undefined ? String(visit.systolicBp) : '',
    diastolicBp: visit?.diastolicBp !== null && visit?.diastolicBp !== undefined ? String(visit.diastolicBp) : '',
    heartRate: visit?.heartRate !== null && visit?.heartRate !== undefined ? String(visit.heartRate) : '',
    respiratoryRate:
      visit?.respiratoryRate !== null && visit?.respiratoryRate !== undefined
        ? String(visit.respiratoryRate)
        : '',
    oxygenSaturation:
      visit?.oxygenSaturation !== null && visit?.oxygenSaturation !== undefined
        ? String(visit.oxygenSaturation)
        : '',
  };
}

function optionalNumber(value: string): number | undefined {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
}

export function VisitForm({
  visit,
  initialPatientId,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  visit?: Visit | null;
  initialPatientId?: string;
  pending: boolean;
  error: unknown;
  onSubmit: (input: VisitInput) => void;
  onCancel: () => void;
}) {
  const [patient, setPatient] = useState<Patient | null | undefined>(undefined);
  const [values, setValues] = useState<Values>(() => valuesFor(visit));
  const [message, setMessage] = useState('');

  const initialPatient = useQuery({
    queryKey: ['patient', initialPatientId],
    queryFn: () => patientsApi.find(initialPatientId ?? ''),
    enabled: !visit && Boolean(initialPatientId),
  });

  const selectedPatient = patient === undefined ? (initialPatient.data ?? null) : patient;

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!visit && !selectedPatient) {
      setMessage('Select a patient.');
      return;
    }
    if (values.systolicBp && values.diastolicBp && Number(values.systolicBp) <= Number(values.diastolicBp)) {
      setMessage('Systolic blood pressure must be higher than diastolic.');
      return;
    }
    const followUpDate = values.followUpAt ? fromDateInput(values.followUpAt) : null;

    onSubmit({
      patientId: visit?.patientId ?? selectedPatient?.id ?? '',
      chiefComplaint: values.chiefComplaint.trim() || undefined,
      diagnosis: values.diagnosis.trim() || undefined,
      clinicalNotes: values.clinicalNotes.trim() || undefined,
      followUpAt: followUpDate ? endOfDay(followUpDate).toISOString() : undefined,
      followUpNotes: values.followUpNotes.trim() || undefined,
      vitals: {
        heightCm: optionalNumber(values.heightCm),
        weightKg: optionalNumber(values.weightKg),
        temperatureC: optionalNumber(values.temperatureC),
        systolicBp: optionalNumber(values.systolicBp),
        diastolicBp: optionalNumber(values.diastolicBp),
        heartRate: optionalNumber(values.heartRate),
        respiratoryRate: optionalNumber(values.respiratoryRate),
        oxygenSaturation: optionalNumber(values.oxygenSaturation),
      },
    });
  }

  return (
    <form className="space-y-6" noValidate onSubmit={submit}>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Patient</h3>
        {visit ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              {visit.patient.firstName} {visit.patient.lastName}
            </p>
            <p className="text-xs text-slate-500">
              {visit.patient.patientNumber} · {visit.visitNumber}
            </p>
          </div>
        ) : (
          <>
            {initialPatient.isPending && initialPatientId ? (
              <p className="text-sm text-slate-500">Loading patient…</p>
            ) : (
              <PatientPicker selected={selectedPatient} onSelect={setPatient} />
            )}
          </>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Clinical assessment</h3>
        <Field label="Chief complaint">
          <Textarea
            rows={2}
            value={values.chiefComplaint}
            onChange={(event) => set('chiefComplaint', event.target.value)}
          />
        </Field>
        <Field label="Diagnosis">
          <Textarea
            rows={2}
            value={values.diagnosis}
            onChange={(event) => set('diagnosis', event.target.value)}
          />
        </Field>
        <Field label="Clinical notes">
          <Textarea
            rows={4}
            value={values.clinicalNotes}
            onChange={(event) => set('clinicalNotes', event.target.value)}
          />
        </Field>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Vitals</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Height (cm)">
            <Input type="number" min="0" step="0.1" value={values.heightCm} onChange={(event) => set('heightCm', event.target.value)} />
          </Field>
          <Field label="Weight (kg)">
            <Input type="number" min="0" step="0.1" value={values.weightKg} onChange={(event) => set('weightKg', event.target.value)} />
          </Field>
          <Field label="Temperature (°C)">
            <Input type="number" min="0" step="0.1" value={values.temperatureC} onChange={(event) => set('temperatureC', event.target.value)} />
          </Field>
          <Field label="Heart rate">
            <Input type="number" min="0" value={values.heartRate} onChange={(event) => set('heartRate', event.target.value)} />
          </Field>
          <Field label="Systolic BP">
            <Input type="number" min="0" value={values.systolicBp} onChange={(event) => set('systolicBp', event.target.value)} />
          </Field>
          <Field label="Diastolic BP">
            <Input type="number" min="0" value={values.diastolicBp} onChange={(event) => set('diastolicBp', event.target.value)} />
          </Field>
          <Field label="Respiratory rate">
            <Input type="number" min="0" value={values.respiratoryRate} onChange={(event) => set('respiratoryRate', event.target.value)} />
          </Field>
          <Field label="Oxygen saturation">
            <Input type="number" min="0" max="100" value={values.oxygenSaturation} onChange={(event) => set('oxygenSaturation', event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Follow-up</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Follow-up date">
            <Input type="date" value={values.followUpAt} onChange={(event) => set('followUpAt', event.target.value)} />
          </Field>
          <Field label="Follow-up notes">
            <Input value={values.followUpNotes} onChange={(event) => set('followUpNotes', event.target.value)} />
          </Field>
        </div>
      </section>

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
          {visit ? 'Save visit' : 'Create visit'}
        </Button>
      </div>
    </form>
  );
}
