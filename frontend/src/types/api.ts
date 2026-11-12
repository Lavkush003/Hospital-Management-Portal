export type UserRole = 'ADMIN' | 'FRONT_DESK' | 'CLINICIAN' | 'PATIENT';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
export type BloodGroup =
  | 'A_POSITIVE'
  | 'A_NEGATIVE'
  | 'B_POSITIVE'
  | 'B_NEGATIVE'
  | 'AB_POSITIVE'
  | 'AB_NEGATIVE'
  | 'O_POSITIVE'
  | 'O_NEGATIVE'
  | 'UNKNOWN';

export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'DECEASED';
export type DoctorStatus = 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
export type StaffStatus = 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE' | 'TERMINATED';

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type VisitStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PrescriptionStatus = 'ISSUED' | 'DISPENSED' | 'CANCELLED';
export type DiagnosticReportType = 'LABORATORY' | 'IMAGING' | 'PATHOLOGY' | 'OTHER';
export type DiagnosticReportStatus =
  | 'ORDERED'
  | 'COLLECTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED';

export type InvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'VOID'
  | 'OVERDUE'
  | 'REFUNDED';

export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'MOBILE_MONEY'
  | 'INSURANCE'
  | 'OTHER';

export type PaymentStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED';
export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface SessionUser {
  id: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  firstName: string;
  lastName: string;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  doctorId?: string;
  staffId?: string;
  patientId?: string;
}

export interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  allergies?: string | null;
  notes?: string | null;
  status: PatientStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentRef {
  id: string;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  location: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { doctors: number; staff: number };
  doctors?: Array<{
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    specialization: string;
    status: DoctorStatus;
  }>;
}

export interface ScheduleBreak {
  id: string;
  startTime: string;
  endTime: string;
}

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  room: string | null;
  isActive: boolean;
  breaks: ScheduleBreak[];
  createdAt: string;
  updatedAt: string;
}

export interface DoctorLeave {
  id: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorUnavailability {
  id: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  userId: string;
  employeeCode: string;
  departmentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  licenseNumber: string;
  specialization: string;
  qualifications: string | null;
  consultationFee: string;
  status: DoctorStatus;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
  department: DepartmentRef;
  user?: {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    lastLoginAt: string | null;
    createdAt: string;
  };
  schedules?: DoctorSchedule[];
  leaves?: DoctorLeave[];
  unavailability?: DoctorUnavailability[];
}

export interface Staff {
  id: string;
  userId: string;
  employeeCode: string;
  departmentId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  jobTitle: string;
  status: StaffStatus;
  hiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  department: DepartmentRef | null;
  user: {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    lastLoginAt: string | null;
    createdAt: string;
  };
}

export interface AppointmentPatient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  phone: string | null;
  email: string | null;
  status: PatientStatus;
}

export interface AppointmentDoctor {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  specialization: string;
  consultationFee: string;
  status: DoctorStatus;
  department: { id: string; code: string; name: string; location: string | null };
}

export interface Appointment {
  id: string;
  appointmentNumber: string;
  patientId: string;
  doctorId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  createdById: string | null;
  cancelledById: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  rescheduledById: string | null;
  rescheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  patient: AppointmentPatient;
  doctor: AppointmentDoctor;
}

export interface VisitPatient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  phone: string | null;
  email: string | null;
  status: PatientStatus;
}

export interface VisitDoctor {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  specialization: string;
  status: DoctorStatus;
  department: { id: string; code: string; name: string };
}

export interface VisitAppointment {
  id: string;
  appointmentNumber: string;
  status: AppointmentStatus;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface ClinicalNoteAuthor {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface ClinicalNoteRevision {
  id: string;
  noteId: string;
  revisionNumber: number;
  previousContent: string;
  newContent: string;
  editReason: string | null;
  editedAt: string;
  editedBy: ClinicalNoteAuthor | null;
}

export interface ClinicalNote {
  id: string;
  visitId?: string;
  patientId?: string;
  content: string;
  author: ClinicalNoteAuthor | null;
  createdAt: string;
  updatedAt: string;
  revisionCount?: number;
  revisions?: ClinicalNoteRevision[];
}

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  instructions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Prescription {
  id: string;
  prescriptionNumber: string;
  visitId: string;
  status: PrescriptionStatus;
  notes: string | null;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
  items: PrescriptionItem[];
}

export interface DiagnosticFileMetadata {
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  storageReference?: string;
  uploadedAt?: string;
}

export interface DiagnosticReport {
  id: string;
  reportNumber: string;
  visitId: string;
  type: DiagnosticReportType;
  status: DiagnosticReportStatus;
  testName: string;
  resultSummary: string | null;
  resultDetails: string | null;
  fileMetadata: DiagnosticFileMetadata | null;
  orderedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  visitNumber: string;
  appointmentId: string | null;
  patientId: string;
  doctorId: string;
  status: VisitStatus;
  chiefComplaint: string | null;
  diagnosis: string | null;
  clinicalNotes: string | null;
  heightCm: string | null;
  weightKg: string | null;
  temperatureC: string | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  startedAt: string;
  endedAt: string | null;
  followUpAt: string | null;
  followUpNotes: string | null;
  createdAt: string;
  updatedAt: string;
  patient: VisitPatient;
  doctor: VisitDoctor;
  appointment: VisitAppointment | null;
}

export interface VisitDetail extends Visit {
  notes: ClinicalNote[];
  prescriptions: Prescription[];
  diagnosticReports: DiagnosticReport[];
}

export interface InvoicePatient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
}

export interface InvoiceVisitRef {
  id: string;
  visitNumber: string;
  appointmentId: string | null;
  startedAt: string;
}

export interface InvoiceAppointmentRef {
  id: string;
  appointmentNumber: string;
  scheduledStart: string;
  status: AppointmentStatus;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  lineTotal: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  amount: string;
  method: PaymentMethod;
  status: PaymentStatus;
  receivedById: string | null;
  paidAt: string | null;
  externalReference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  visitId: string | null;
  appointmentId: string | null;
  status: InvoiceStatus;
  currency: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  amountPaid: string;
  pendingAmount: string;
  balanceDue: string;
  invoiceDate: string;
  issuedAt: string | null;
  dueAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  patient: InvoicePatient;
  visit: InvoiceVisitRef | null;
  appointment: InvoiceAppointmentRef | null;
  items: InvoiceItem[];
  payments: Payment[];
}

export interface InvoiceHistoryEvent {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
  requestId: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  outcome: AuditOutcome;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
  } | null;
}

export interface AppointmentReportBucket {
  date: string;
  total: number;
  scheduled: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface DepartmentAppointmentSummary {
  departmentId: string;
  departmentName: string;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export interface DoctorAppointmentSummary {
  doctorId: string;
  doctorName: string;
  specialization: string;
  departmentName: string;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  utilizationPercent: number | null;
}

export interface DoctorUtilizationSummary {
  doctorId: string;
  doctorName: string;
  specialization: string;
  departmentName: string;
  appointmentCount: number;
  bookedMinutes: number;
  availableMinutes: number;
  utilizationPercent: number | null;
}

export interface FinancialSummary {
  currency: string;
  invoicedAmount: string;
  outstandingBalance: string;
  successfulPaymentAmount: string;
}

export interface PaymentSummary {
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  count: number;
  amount: string;
}

export interface OutstandingInvoiceReportItem {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  dueAt: string | null;
  invoiceDate: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
}

export interface DashboardAnalytics {
  period: { from: string; to: string };
  totals: {
    registeredPatients: number;
    doctors: number;
    appointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    upcomingAppointments: number;
    completedVisits: number;
    doctorUtilizationPercent: number | null;
  };
  financialsByCurrency: FinancialSummary[];
  dailyAppointments: AppointmentReportBucket[];
  doctorUtilization: DoctorUtilizationSummary[];
}

export interface AdminReports {
  period: { from: string; to: string };
  dailyAppointments: AppointmentReportBucket[];
  monthlyAppointments: AppointmentReportBucket[];
  departmentAppointments: DepartmentAppointmentSummary[];
  doctorAppointments: DoctorAppointmentSummary[];
  doctorUtilization: DoctorUtilizationSummary[];
  financialsByCurrency: FinancialSummary[];
  paymentSummary: PaymentSummary[];
  outstandingInvoices: {
    items: OutstandingInvoiceReportItem[];
    pagination: Pagination;
  };
}

export interface UserAccount {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  firstName: string;
  lastName: string;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  doctor: { id: string } | null;
  staff: { id: string } | null;
}

export interface AvailableDoctor extends Doctor {
  availableSlotCount: number;
  nextAvailableSlot: string | null;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface ClinicalSummaryPatient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: BloodGroup;
  allergies: string | null;
  status: PatientStatus;
}

export interface ClinicalSummaryVisit {
  id: string;
  visitNumber: string;
  status: VisitStatus;
  chiefComplaint: string | null;
  diagnosis: string | null;
  clinicalNotes: string | null;
  heightCm: string | null;
  weightKg: string | null;
  temperatureC: string | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  startedAt: string;
  endedAt: string | null;
  doctor: { id: string; firstName: string; lastName: string; specialization: string };
  prescriptions: Array<{
    id: string;
    prescriptionNumber: string;
    status: PrescriptionStatus;
    notes: string | null;
    issuedAt: string;
    items: PrescriptionItem[];
  }>;
  diagnosticReports: DiagnosticReport[];
  notes: ClinicalNote[];
  invoice?: { id: string; invoiceNumber: string; status: InvoiceStatus; totalAmount: string; currency: string } | null;
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    totalAmount: string;
    currency: string;
  }>;
}

export interface ClinicalSummary {
  patient: ClinicalSummaryPatient;
  visits: ClinicalSummaryVisit[];
}

export type PatientListResponse = { patients: Patient[]; pagination: Pagination };
export type DoctorListResponse = { doctors: Doctor[]; pagination: Pagination };
export type DepartmentListResponse = { departments: Department[]; pagination: Pagination };
export type StaffListResponse = { staff: Staff[]; pagination: Pagination };
export type AppointmentListResponse = { appointments: Appointment[]; pagination: Pagination };
export type VisitListResponse = { visits: Visit[]; pagination: Pagination };
export type InvoiceListResponse = { invoices: Invoice[]; pagination: Pagination };
export type AuditLogListResponse = { logs: AuditLog[]; pagination: Pagination };

export interface AvailableDoctorListResponse {
  doctors: AvailableDoctor[];
  pagination: Pagination;
  range: { start: string; end: string };
}

export interface AvailableSlotsResponse {
  doctorId: string;
  range: { start: string; end: string };
  slots: AvailabilitySlot[];
}

export interface DoctorScheduleResponse {
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
    specialization: string;
    status: DoctorStatus;
  };
  schedules: DoctorSchedule[];
}
