import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PatientInput } from '@/services/hms';
import { patientsApi } from '@/services/hms';
import { useToast } from '@/components/feedback/toast-context';
import { Card, PageHeader } from '@/components/ui/Card';
import { PatientForm } from './PatientForm';

export function RegisterPatientPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<unknown>(null);

  const mutation = useMutation({
    mutationFn: (input: PatientInput) => patientsApi.create(input),
    onSuccess: (patient) => {
      toast({
        title: 'Patient registered',
        description: `${patient.firstName} ${patient.lastName} · ${patient.patientNumber}`,
      });
      setError(null);
      setFormKey((key) => key + 1);
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (caught) => setError(caught),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Front desk"
        title="Register a patient"
        description="Create a complete patient record before booking appointments or raising invoices."
        actions={
          <Link
            to="/front-desk/patients"
            className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Patient directory
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <PatientForm
            key={formKey}
            canEditClinical={false}
            pending={mutation.isPending}
            error={error}
            submitLabel="Register patient"
            onSubmit={(input) => mutation.mutate(input)}
          />
        </Card>

        <aside className="space-y-4">
          <Card className="bg-gradient-to-br from-brand-700 to-teal-700 text-white">
            <h2 className="text-base font-semibold">Before you register</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-brand-50/90">
              <li>Search the directory first to avoid duplicate patient records.</li>
              <li>Confirm the patient's legal name against an identity document.</li>
              <li>Record at least one reliable contact and an emergency contact.</li>
              <li>Clinical flags such as allergies are added by authorized clinical staff.</li>
            </ul>
          </Card>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">What happens next</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              The hospital assigns a unique patient number. You can then book an appointment,
              view availability and create invoices from the patient's record.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
