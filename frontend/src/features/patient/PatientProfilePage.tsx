import { useQuery } from '@tanstack/react-query';
import { patientsApi } from '@/services/hms';
import { useAuth } from '@/features/auth/auth-context';
import { formatDate, formatDateOnly, formatDateTime, getAge, humanize } from '@/utils/format';
import { statusTone } from '@/utils/status';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/States';
import { Avatar } from '@/components/ui/Display';
import { DetailRow } from '@/components/feedback/FormBits';

export function PatientProfilePage() {
  const { user } = useAuth();
  const patientId = user?.patientId ?? '';

  const query = useQuery({
    queryKey: ['patient-profile', patientId],
    queryFn: () => patientsApi.find(patientId),
    enabled: patientId !== '',
  });

  if (!patientId) {
    return (
      <Card>
        <ErrorState message="Your account is not linked to a patient record. Please contact the front desk." />
      </Card>
    );
  }

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

  if (!query.data) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Loading your profile…</p>
      </Card>
    );
  }

  const patient = query.data;
  const address =
    [
      patient.addressLine1,
      patient.addressLine2,
      patient.city,
      patient.state,
      patient.postalCode,
      patient.country,
    ]
      .filter(Boolean)
      .join(', ') || '—';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My account"
        title="Patient profile"
        description="Your registered hospital record and contact details."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <div className="flex items-center gap-4">
            <Avatar firstName={patient.firstName} lastName={patient.lastName} size="lg" />
            <div>
              <p className="text-xl font-semibold text-slate-950">
                {patient.firstName} {patient.lastName}
              </p>
              <p className="text-sm text-slate-500">{patient.patientNumber}</p>
              <Badge tone={statusTone(patient.status)} dot className="mt-2">
                {humanize(patient.status)}
              </Badge>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-slate-100">
            <DetailRow label="Date of birth" value={formatDateOnly(patient.dateOfBirth)} />
            <DetailRow label="Age" value={`${getAge(patient.dateOfBirth)} years`} />
            <DetailRow label="Gender" value={humanize(patient.gender)} />
            <DetailRow label="Blood group" value={humanize(patient.bloodGroup)} />
            <DetailRow label="Phone" value={patient.phone ?? '—'} />
            <DetailRow label="Email" value={patient.email ?? '—'} />
          </dl>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Address and emergency contact" />
            <dl className="mt-3 divide-y divide-slate-100">
              <DetailRow label="Address" value={address} />
              <DetailRow
                label="Emergency contact"
                value={
                  patient.emergencyContactName
                    ? `${patient.emergencyContactName}${patient.emergencyContactPhone ? ` · ${patient.emergencyContactPhone}` : ''}`
                    : '—'
                }
              />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Record" description="Administrative details for your patient record." />
            <dl className="mt-3 divide-y divide-slate-100">
              <DetailRow label="Patient number" value={patient.patientNumber} />
              <DetailRow label="Registered" value={formatDate(patient.createdAt)} />
              <DetailRow label="Last updated" value={formatDateTime(patient.updatedAt)} />
            </dl>
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              To update your contact or insurance details, please contact the hospital front desk.
              Clinical information is released only through authorised hospital staff.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
