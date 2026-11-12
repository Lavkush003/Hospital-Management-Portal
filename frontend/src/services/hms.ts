import type {
  Appointment,
  AppointmentListResponse,
  AdminReports,
  AppointmentStatus,
  AuditLog,
  AuditLogListResponse,
  AvailableDoctorListResponse,
  AvailableSlotsResponse,
  BloodGroup,
  ClinicalNote,
  ClinicalSummary,
  Department,
  DashboardAnalytics,
  DepartmentListResponse,
  DiagnosticReport,
  DiagnosticReportType,
  Doctor,
  DoctorLeave,
  DoctorListResponse,
  DoctorSchedule,
  DoctorScheduleResponse,
  DoctorUnavailability,
  Gender,
  Invoice,
  InvoiceHistoryEvent,
  InvoiceListResponse,
  InvoiceStatus,
  Pagination,
  Patient,
  PatientListResponse,
  PatientStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Prescription,
  PrescriptionStatus,
  SessionUser,
  Staff,
  StaffListResponse,
  UserAccount,
  Visit,
  VisitDetail,
  VisitListResponse,
  VisitStatus,
} from '@/types/api';
import { apiGet, apiMutate, newIdempotencyKey, toQuery } from '@/services/api';

export interface ListParams {
  page?: number;
  pageSize?: number;
}

export interface PageResult<T> {
  items: T[];
  pagination: Pagination;
}

interface SessionResponse {
  accessToken: string;
  csrfToken: string;
  user: SessionUser;
}

export interface RegisterPatientInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone?: string;
  gender?: Gender;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface PatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies?: string;
  notes?: string;
  status?: PatientStatus;
}

export interface DepartmentInput {
  code: string;
  name: string;
  description?: string;
  location?: string;
  phone?: string;
  isActive?: boolean;
}

export interface DoctorInput {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  employeeCode: string;
  departmentId: string;
  licenseNumber: string;
  specialization: string;
  qualifications?: string;
  consultationFee?: number;
  status?: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  bio?: string;
}

export interface StaffInput {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  employeeCode: string;
  departmentId?: string | null;
  jobTitle: string;
  status?: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE' | 'TERMINATED';
  role?: 'ADMIN' | 'FRONT_DESK';
  hiredAt?: string | null;
}

export interface ScheduleBreakInput {
  startTime: string;
  endTime: string;
}

export interface ScheduleInput {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  breakTimes: ScheduleBreakInput[];
  room?: string;
  isActive: boolean;
}

export interface LeaveInput {
  startAt: string;
  endAt: string;
  reason?: string;
}

export interface AppointmentQuery extends ListParams {
  status?: AppointmentStatus;
  doctorId?: string;
  patientId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface BookAppointmentInput {
  patientId: string;
  doctorId: string;
  scheduledStart: string;
  scheduledEnd: string;
  reason?: string;
  notes?: string;
}

export interface VisitInput {
  patientId: string;
  doctorId?: string;
  appointmentId?: string;
  startedAt?: string;
  chiefComplaint?: string;
  diagnosis?: string;
  clinicalNotes?: string;
  followUpAt?: string;
  followUpNotes?: string;
  vitals?: {
    heightCm?: number;
    weightKg?: number;
    temperatureC?: number;
    systolicBp?: number;
    diastolicBp?: number;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
}

export interface UpdateVisitInput {
  chiefComplaint?: string;
  diagnosis?: string;
  clinicalNotes?: string;
  followUpAt?: string | null;
  followUpNotes?: string;
  vitals?: VisitInput['vitals'];
}

export interface PrescriptionItemInput {
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  instructions?: string;
}

export interface PrescriptionInput {
  items: PrescriptionItemInput[];
  notes?: string;
}

export interface ReportInput {
  testName: string;
  type: DiagnosticReportType;
  orderedAt?: string;
  resultSummary?: string;
  resultDetails?: string;
  fileMetadata?: {
    name: string;
    mimeType?: string;
    sizeBytes?: number;
    storageReference?: string;
  };
}

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: string;
  discountAmount?: string;
  taxAmount?: string;
}

export interface InvoiceInput {
  patientId: string;
  visitId?: string;
  appointmentId?: string;
  currency?: string;
  invoiceDate?: string;
  dueAt: string;
  items: InvoiceItemInput[];
  notes?: string;
}

export interface PaymentInput {
  amount: string;
  method: PaymentMethod;
  externalReference?: string;
  notes?: string;
}

export interface AuditLogQuery extends ListParams {
  action?: string;
  entityType?: string;
  actorUserId?: string;
  search?: string;
  outcome?: 'SUCCESS' | 'FAILURE';
  from?: string;
  to?: string;
}

export interface AnalyticsQuery {
  from: string;
  to: string;
}

export interface ReportsQuery extends AnalyticsQuery, ListParams {
  search?: string;
}

function unwrapList<K extends string, T>(
  key: K,
  result: Record<K, T[]> & { pagination: Pagination },
): PageResult<T> {
  return { items: result[key], pagination: result.pagination };
}

export const authApi = {
  login(email: string, password: string): Promise<SessionResponse> {
    return apiMutate<SessionResponse>('/auth/login', 'POST', { email, password });
  },
  register(input: RegisterPatientInput): Promise<SessionResponse> {
    return apiMutate<SessionResponse>('/auth/register', 'POST', input);
  },
  logout(): Promise<void> {
    return apiMutate<void>('/auth/logout', 'POST');
  },
  me(): Promise<{ user: SessionUser }> {
    return apiGet<{ user: SessionUser }>('/auth/me');
  },
  changePassword(input: ChangePasswordInput): Promise<void> {
    return apiMutate<void>('/auth/change-password', 'POST', input);
  },
};

export const patientsApi = {
  async list(
    params: ListParams & {
      search?: string;
      status?: PatientStatus;
      gender?: Gender;
      bloodGroup?: BloodGroup;
      city?: string;
    } = {},
  ): Promise<PatientListResponse> {
    return apiGet<PatientListResponse>(`/patients${toQuery({ ...params })}`);
  },
  async find(id: string): Promise<Patient> {
    const result = await apiGet<{ patient: Patient }>(`/patients/${id}`);
    return result.patient;
  },
  async create(input: PatientInput): Promise<Patient> {
    const result = await apiMutate<{ patient: Patient }>('/patients', 'POST', input);
    return result.patient;
  },
  async update(id: string, input: Partial<PatientInput>): Promise<Patient> {
    const result = await apiMutate<{ patient: Patient }>(`/patients/${id}`, 'PATCH', input);
    return result.patient;
  },
};

export const departmentsApi = {
  async list(
    params: ListParams & { search?: string; isActive?: boolean } = {},
  ): Promise<DepartmentListResponse> {
    return apiGet<DepartmentListResponse>(`/departments${toQuery({ ...params })}`);
  },
  async find(id: string): Promise<Department> {
    const result = await apiGet<{ department: Department }>(`/departments/${id}`);
    return result.department;
  },
  async create(input: DepartmentInput): Promise<Department> {
    const result = await apiMutate<{ department: Department }>('/departments', 'POST', input);
    return result.department;
  },
  async update(id: string, input: Partial<DepartmentInput>): Promise<Department> {
    const result = await apiMutate<{ department: Department }>(
      `/departments/${id}`,
      'PATCH',
      input,
    );
    return result.department;
  },
  async assignDoctors(id: string, doctorIds: string[]): Promise<Department> {
    const result = await apiMutate<{ department: Department }>(
      `/departments/${id}/doctors`,
      'POST',
      { doctorIds },
    );
    return result.department;
  },
};

export const doctorsApi = {
  async list(
    params: ListParams & {
      search?: string;
      departmentId?: string;
      specialization?: string;
      status?: string;
    } = {},
  ): Promise<DoctorListResponse> {
    return apiGet<DoctorListResponse>(`/doctors${toQuery({ ...params })}`);
  },
  async find(id: string): Promise<Doctor> {
    const result = await apiGet<{ doctor: Doctor }>(`/doctors/${id}`);
    return result.doctor;
  },
  async create(input: DoctorInput): Promise<Doctor> {
    const result = await apiMutate<{ doctor: Doctor }>('/doctors', 'POST', input);
    return result.doctor;
  },
  async update(id: string, input: Partial<Omit<DoctorInput, 'password'>>): Promise<Doctor> {
    const result = await apiMutate<{ doctor: Doctor }>(`/doctors/${id}`, 'PATCH', input);
    return result.doctor;
  },
  async setStatus(
    id: string,
    status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE',
    reason?: string,
  ): Promise<Doctor> {
    const result = await apiMutate<{ doctor: Doctor }>(`/doctors/${id}/status`, 'PATCH', {
      status,
      ...(reason ? { reason } : {}),
    });
    return result.doctor;
  },
};

export const staffApi = {
  async list(
    params: ListParams & {
      search?: string;
      departmentId?: string;
      status?: string;
      role?: string;
    } = {},
  ): Promise<StaffListResponse> {
    return apiGet<StaffListResponse>(`/staff${toQuery({ ...params })}`);
  },
  async find(id: string): Promise<Staff> {
    const result = await apiGet<{ staff: Staff }>(`/staff/${id}`);
    return result.staff;
  },
  async create(input: StaffInput): Promise<Staff> {
    const result = await apiMutate<{ staff: Staff }>('/staff', 'POST', input);
    return result.staff;
  },
  async update(id: string, input: Partial<Omit<StaffInput, 'password'>>): Promise<Staff> {
    const result = await apiMutate<{ staff: Staff }>(`/staff/${id}`, 'PATCH', input);
    return result.staff;
  },
  async setStatus(id: string, status: Staff['status'], reason?: string): Promise<Staff> {
    const result = await apiMutate<{ staff: Staff }>(`/staff/${id}/status`, 'PATCH', {
      status,
      ...(reason ? { reason } : {}),
    });
    return result.staff;
  },
  async setRole(id: string, role: 'ADMIN' | 'FRONT_DESK', reason?: string): Promise<Staff> {
    const result = await apiMutate<{ staff: Staff }>(`/staff/${id}/role`, 'PATCH', {
      role,
      ...(reason ? { reason } : {}),
    });
    return result.staff;
  },
};

export const schedulesApi = {
  get(doctorId: string): Promise<DoctorScheduleResponse> {
    return apiGet<DoctorScheduleResponse>(`/doctors/${doctorId}/schedule`);
  },
  list(doctorId: string): Promise<DoctorScheduleResponse> {
    return apiGet<DoctorScheduleResponse>(`/doctors/${doctorId}/schedules`);
  },
  async create(doctorId: string, input: ScheduleInput): Promise<DoctorSchedule> {
    const result = await apiMutate<{ schedule: DoctorSchedule }>(
      `/doctors/${doctorId}/schedules`,
      'POST',
      input,
    );
    return result.schedule;
  },
  async update(
    doctorId: string,
    scheduleId: string,
    input: Partial<ScheduleInput>,
  ): Promise<DoctorSchedule> {
    const result = await apiMutate<{ schedule: DoctorSchedule }>(
      `/doctors/${doctorId}/schedules/${scheduleId}`,
      'PATCH',
      input,
    );
    return result.schedule;
  },
  remove(doctorId: string, scheduleId: string): Promise<void> {
    return apiMutate<void>(`/doctors/${doctorId}/schedules/${scheduleId}`, 'DELETE');
  },
  listLeaves(
    doctorId: string,
    params: ListParams & { start?: string; end?: string } = {},
  ): Promise<{ leaves: DoctorLeave[]; pagination: Pagination }> {
    return apiGet<{ leaves: DoctorLeave[]; pagination: Pagination }>(
      `/doctors/${doctorId}/leaves${toQuery({ ...params })}`,
    );
  },
  async createLeave(doctorId: string, input: LeaveInput): Promise<DoctorLeave> {
    const result = await apiMutate<{ leave: DoctorLeave }>(
      `/doctors/${doctorId}/leaves`,
      'POST',
      input,
    );
    return result.leave;
  },
  removeLeave(doctorId: string, leaveId: string): Promise<void> {
    return apiMutate<void>(`/doctors/${doctorId}/leaves/${leaveId}`, 'DELETE');
  },
  listUnavailability(
    doctorId: string,
    params: ListParams & { start?: string; end?: string } = {},
  ): Promise<{ unavailability: DoctorUnavailability[]; pagination: Pagination }> {
    return apiGet<{ unavailability: DoctorUnavailability[]; pagination: Pagination }>(
      `/doctors/${doctorId}/unavailability${toQuery({ ...params })}`,
    );
  },
  async createUnavailability(
    doctorId: string,
    input: LeaveInput,
  ): Promise<DoctorUnavailability> {
    const result = await apiMutate<{ unavailability: DoctorUnavailability }>(
      `/doctors/${doctorId}/unavailability`,
      'POST',
      input,
    );
    return result.unavailability;
  },
  removeUnavailability(doctorId: string, unavailabilityId: string): Promise<void> {
    return apiMutate<void>(
      `/doctors/${doctorId}/unavailability/${unavailabilityId}`,
      'DELETE',
    );
  },
};

export const appointmentsApi = {
  list(params: AppointmentQuery = {}): Promise<AppointmentListResponse> {
    return apiGet<AppointmentListResponse>(`/appointments${toQuery({ ...params })}`);
  },
  async find(id: string): Promise<Appointment> {
    const result = await apiGet<{ appointment: Appointment }>(`/appointments/${id}`);
    return result.appointment;
  },
  availableDoctors(
    params: {
      start: string;
      end: string;
      search?: string;
      departmentId?: string;
      specialization?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<AvailableDoctorListResponse> {
    return apiGet<AvailableDoctorListResponse>(
      `/appointments/available-doctors${toQuery({ ...params })}`,
    );
  },
  availableSlots(params: {
    start: string;
    end: string;
    doctorId: string;
  }): Promise<AvailableSlotsResponse> {
    return apiGet<AvailableSlotsResponse>(
      `/appointments/available-slots${toQuery({ ...params })}`,
    );
  },
  async book(input: BookAppointmentInput): Promise<Appointment> {
    const result = await apiMutate<{ appointment: Appointment }>(
      '/appointments',
      'POST',
      input,
      newIdempotencyKey(),
    );
    return result.appointment;
  },
  async reschedule(
    id: string,
    input: { scheduledStart: string; scheduledEnd: string; reason?: string },
  ): Promise<Appointment> {
    const result = await apiMutate<{ appointment: Appointment }>(
      `/appointments/${id}/reschedule`,
      'POST',
      input,
      newIdempotencyKey(),
    );
    return result.appointment;
  },
  async cancel(id: string, cancellationReason: string): Promise<Appointment> {
    const result = await apiMutate<{ appointment: Appointment }>(
      `/appointments/${id}/cancel`,
      'POST',
      { cancellationReason },
      newIdempotencyKey(),
    );
    return result.appointment;
  },
  async setStatus(
    id: string,
    status: AppointmentStatus,
    reason?: string,
  ): Promise<Appointment> {
    const result = await apiMutate<{ appointment: Appointment }>(
      `/appointments/${id}/status`,
      'PATCH',
      { status, ...(reason ? { reason } : {}) },
    );
    return result.appointment;
  },
};

export const visitsApi = {
  list(
    params: ListParams & {
      patientId?: string;
      doctorId?: string;
      appointmentId?: string;
      status?: VisitStatus;
      from?: string;
      to?: string;
      search?: string;
    } = {},
  ): Promise<VisitListResponse> {
    return apiGet<VisitListResponse>(`/visits${toQuery({ ...params })}`);
  },
  async find(id: string): Promise<VisitDetail> {
    const result = await apiGet<{ visit: VisitDetail }>(`/visits/${id}`);
    return result.visit;
  },
  async create(input: VisitInput): Promise<Visit> {
    const result = await apiMutate<{ visit: Visit }>('/visits', 'POST', input);
    return result.visit;
  },
  async update(id: string, input: UpdateVisitInput): Promise<Visit> {
    const result = await apiMutate<{ visit: Visit }>(`/visits/${id}`, 'PATCH', input);
    return result.visit;
  },
  async setStatus(id: string, status: VisitStatus, reason?: string): Promise<Visit> {
    const result = await apiMutate<{ visit: Visit }>(`/visits/${id}/status`, 'PATCH', {
      status,
      ...(reason ? { reason } : {}),
    });
    return result.visit;
  },
};

export const notesApi = {
  list(visitId: string): Promise<ClinicalNote[]> {
    return apiGet<{ notes: ClinicalNote[] }>(`/visits/${visitId}/notes`).then(
      (result) => result.notes,
    );
  },
  async create(visitId: string, content: string): Promise<ClinicalNote> {
    const result = await apiMutate<{ note: ClinicalNote }>(
      `/visits/${visitId}/notes`,
      'POST',
      { content },
    );
    return result.note;
  },
  async update(
    visitId: string,
    noteId: string,
    input: { content: string; editReason?: string },
  ): Promise<ClinicalNote> {
    const result = await apiMutate<{ note: ClinicalNote }>(
      `/visits/${visitId}/notes/${noteId}`,
      'PATCH',
      input,
    );
    return result.note;
  },
};

export const prescriptionsApi = {
  list(visitId: string): Promise<Prescription[]> {
    return apiGet<{ prescriptions: Prescription[] }>(
      `/visits/${visitId}/prescriptions`,
    ).then((result) => result.prescriptions);
  },
  async create(visitId: string, input: PrescriptionInput): Promise<Prescription> {
    const result = await apiMutate<{ prescription: Prescription }>(
      `/visits/${visitId}/prescriptions`,
      'POST',
      input,
    );
    return result.prescription;
  },
  async setStatus(
    visitId: string,
    prescriptionId: string,
    status: PrescriptionStatus,
    reason?: string,
  ): Promise<Prescription> {
    const result = await apiMutate<{ prescription: Prescription }>(
      `/visits/${visitId}/prescriptions/${prescriptionId}/status`,
      'PATCH',
      { status, ...(reason ? { reason } : {}) },
    );
    return result.prescription;
  },
};

export const reportsApi = {
  list(visitId: string): Promise<DiagnosticReport[]> {
    return apiGet<{ reports: DiagnosticReport[] }>(`/visits/${visitId}/reports`).then(
      (result) => result.reports,
    );
  },
  async create(visitId: string, input: ReportInput): Promise<DiagnosticReport> {
    const result = await apiMutate<{ report: DiagnosticReport }>(
      `/visits/${visitId}/reports`,
      'POST',
      input,
    );
    return result.report;
  },
  async update(
    visitId: string,
    reportId: string,
    input: Partial<ReportInput> & {
      status?: DiagnosticReport['status'];
      reason?: string;
    },
  ): Promise<DiagnosticReport> {
    const result = await apiMutate<{ report: DiagnosticReport }>(
      `/visits/${visitId}/reports/${reportId}`,
      'PATCH',
      input,
    );
    return result.report;
  },
};

export const billingApi = {
  list(
    params: ListParams & {
      patientId?: string;
      visitId?: string;
      appointmentId?: string;
      status?: InvoiceStatus;
      from?: string;
      to?: string;
    } = {},
  ): Promise<InvoiceListResponse> {
    return apiGet<InvoiceListResponse>(`/billing/invoices${toQuery({ ...params })}`);
  },
  async find(id: string): Promise<Invoice> {
    const result = await apiGet<{ invoice: Invoice }>(`/billing/invoices/${id}`);
    return result.invoice;
  },
  async create(input: InvoiceInput): Promise<Invoice> {
    const result = await apiMutate<{ invoice: Invoice }>(
      '/billing/invoices',
      'POST',
      input,
      newIdempotencyKey(),
    );
    return result.invoice;
  },
  async update(id: string, input: Partial<InvoiceInput>): Promise<Invoice> {
    const result = await apiMutate<{ invoice: Invoice }>(
      `/billing/invoices/${id}`,
      'PATCH',
      input,
    );
    return result.invoice;
  },
  async setStatus(id: string, status: 'ISSUED' | 'OVERDUE' | 'VOID', reason?: string): Promise<Invoice> {
    const result = await apiMutate<{ invoice: Invoice }>(
      `/billing/invoices/${id}/status`,
      'PATCH',
      { status, ...(reason ? { reason } : {}) },
    );
    return result.invoice;
  },
  history(id: string): Promise<InvoiceHistoryEvent[]> {
    return apiGet<{ history: InvoiceHistoryEvent[] }>(
      `/billing/invoices/${id}/history`,
    ).then((result) => result.history);
  },
  payments(id: string): Promise<Payment[]> {
    return apiGet<{ payments: Payment[] }>(`/billing/invoices/${id}/payments`).then(
      (result) => result.payments,
    );
  },
  async createPayment(id: string, input: PaymentInput): Promise<Payment> {
    const result = await apiMutate<{ payment: Payment }>(
      `/billing/invoices/${id}/payments`,
      'POST',
      input,
      newIdempotencyKey(),
    );
    return result.payment;
  },
  async setPaymentStatus(
    paymentId: string,
    status: Extract<PaymentStatus, 'SUCCESSFUL' | 'FAILED'>,
    reason?: string,
  ): Promise<Payment> {
    const result = await apiMutate<{ payment: Payment }>(
      `/billing/payments/${paymentId}/status`,
      'PATCH',
      { status, ...(reason ? { reason } : {}) },
    );
    return result.payment;
  },
};

export const adminApi = {
  users(): Promise<UserAccount[]> {
    return apiGet<{ users: UserAccount[] }>('/admin/users').then((result) => result.users);
  },
  auditLogs(params: AuditLogQuery = {}): Promise<PageResult<AuditLog>> {
    return apiGet<AuditLogListResponse>(`/admin/audit-logs${toQuery({ ...params })}`).then(
      (result) => unwrapList('logs', result),
    );
  },
  analytics(params: AnalyticsQuery): Promise<DashboardAnalytics> {
    return apiGet<DashboardAnalytics>(`/admin/analytics${toQuery({ ...params })}`);
  },
  reports(params: ReportsQuery): Promise<AdminReports> {
    return apiGet<AdminReports>(`/admin/reports${toQuery({ ...params })}`);
  },
};

export const clinicalApi = {
  summary(patientId: string): Promise<ClinicalSummary> {
    return apiGet<ClinicalSummary>(`/patients/${patientId}/clinical-summary`);
  },
};
