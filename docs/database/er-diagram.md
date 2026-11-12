# Entity-Relationship Diagram

The diagram uses Prisma model names. PostgreSQL stores these as quoted PascalCase table
names such as `"Appointment"`. Enum values and every scalar field are documented in the
[data dictionary](data-dictionary.md).

```mermaid
erDiagram
  USER ||--o| DOCTOR : "has clinician profile"
  USER ||--o| STAFF : "has staff profile"
  DEPARTMENT ||--o{ DOCTOR : "employs"
  DEPARTMENT |o--o{ STAFF : "assigns"
  DOCTOR ||--o{ DOCTOR_SCHEDULE : "publishes"
  DOCTOR_SCHEDULE ||--o{ DOCTOR_SCHEDULE_BREAK : "pauses"
  DOCTOR ||--o{ DOCTOR_LEAVE : "is away"
  DOCTOR ||--o{ DOCTOR_UNAVAILABILITY : "is unavailable"

  PATIENT ||--o{ APPOINTMENT : "books"
  DOCTOR ||--o{ APPOINTMENT : "receives"
  USER |o--o{ APPOINTMENT : "creates"
  USER |o--o{ APPOINTMENT : "cancels"
  USER |o--o{ APPOINTMENT : "reschedules"

  APPOINTMENT |o--o| VISIT : "may become"
  PATIENT ||--o{ VISIT : "attends"
  DOCTOR ||--o{ VISIT : "documents"
  PATIENT ||--o{ INVOICE : "is billed"
  APPOINTMENT |o--o{ INVOICE : "may be billed"

  VISIT ||--o{ PRESCRIPTION : "issues"
  PRESCRIPTION ||--o{ PRESCRIPTION_ITEM : "contains"
  VISIT ||--o{ DIAGNOSTIC_REPORT : "orders"
  VISIT ||--o{ INVOICE : "may be billed"

  INVOICE ||--o{ INVOICE_ITEM : "contains"
  INVOICE ||--o{ PAYMENT : "is settled by"
  USER |o--o{ PAYMENT : "receives"

  USER |o--o{ AUDIT_LOG : "acts in"
  USER ||--o{ IDEMPOTENCY_KEY : "owns"
  USER ||--o{ REFRESH_TOKEN : "authenticates with"
  REFRESH_TOKEN |o--o| REFRESH_TOKEN : "replaced by"

  USER {
    string id PK
    string email UK
    string passwordHash
    string role
    string status
    string firstName
    string lastName
    datetime lastLoginAt
    int authVersion
    datetime passwordChangedAt
  }

  PATIENT {
    string id PK
    string patientNumber UK
    string firstName
    string lastName
    date dateOfBirth
    string gender
    string bloodGroup
    string phone
    string status
  }

  DEPARTMENT {
    string id PK
    string code UK
    string name UK
    boolean isActive
  }

  DOCTOR {
    string id PK
    string userId FK
    string employeeCode UK
    string departmentId FK
    string email UK
    string licenseNumber UK
    string specialization
    decimal consultationFee
    string status
  }

  STAFF {
    string id PK
    string userId FK
    string employeeCode UK
    string departmentId FK
    string email UK
    string jobTitle
    string status
  }

  DOCTOR_SCHEDULE {
    string id PK
    string doctorId FK
    string dayOfWeek
    time startTime
    time endTime
    int slotDurationMinutes
    boolean isActive
  }

  DOCTOR_SCHEDULE_BREAK {
    string id PK
    string scheduleId FK
    time startTime
    time endTime
  }

  DOCTOR_LEAVE {
    string id PK
    string doctorId FK
    datetime startAt
    datetime endAt
    string reason
  }

  DOCTOR_UNAVAILABILITY {
    string id PK
    string doctorId FK
    datetime startAt
    datetime endAt
    string reason
  }

  APPOINTMENT {
    string id PK
    string appointmentNumber UK
    string patientId FK
    string doctorId FK
    datetime scheduledStart
    datetime scheduledEnd
    string status
    string createdById FK
    string cancelledById FK
    datetime cancelledAt
    string rescheduledById FK
    datetime rescheduledAt
  }

  VISIT {
    string id PK
    string visitNumber UK
    string appointmentId FK
    string patientId FK
    string doctorId FK
    string status
    string diagnosis
    datetime startedAt
    datetime endedAt
  }

  PRESCRIPTION {
    string id PK
    string prescriptionNumber UK
    string visitId FK
    string status
    datetime issuedAt
  }

  PRESCRIPTION_ITEM {
    string id PK
    string prescriptionId FK
    string medicationName
    string dosage
    string frequency
    int durationDays
    int quantity
  }

  DIAGNOSTIC_REPORT {
    string id PK
    string reportNumber UK
    string visitId FK
    string type
    string status
    string testName
    datetime orderedAt
    datetime completedAt
  }

  INVOICE {
    string id PK
    string invoiceNumber UK
    string patientId FK
    string visitId FK
    string appointmentId FK
    string status
    string currency
    decimal subtotal
    decimal discountAmount
    decimal taxAmount
    decimal totalAmount
    datetime invoiceDate
    datetime issuedAt
    datetime dueAt
  }

  INVOICE_ITEM {
    string id PK
    string invoiceId FK
    string description
    int quantity
    decimal unitPrice
    decimal discountAmount
    decimal taxAmount
    decimal lineTotal
  }

  PAYMENT {
    string id PK
    string paymentNumber UK
    string invoiceId FK
    decimal amount
    string method
    string status "PENDING/SUCCESSFUL/FAILED"
    string receivedById FK
    datetime paidAt
    string externalReference UK
  }

  AUDIT_LOG {
    string id PK
    string actorUserId FK
    string action
    string entityType
    string entityId
    json before
    json after
    json metadata
    string requestId
    datetime createdAt
  }

  IDEMPOTENCY_KEY {
    string id PK
    string actorUserId FK
    string scope
    string key
    string requestHash
    string status
    string resourceType
    string resourceId
    int responseStatusCode
    json responseBody
    datetime expiresAt
  }

  REFRESH_TOKEN {
    string id PK
    string userId FK
    string tokenHash UK
    string familyId
    datetime expiresAt
    datetime revokedAt
    string revokedReason
    string replacedByTokenId FK
    string ipAddress
    string userAgent
    datetime createdAt
    datetime updatedAt
  }
```

## Relationship summary

| Child / foreign key               | Parent           | Cardinality                    | On delete  |
| --------------------------------- | ---------------- | ------------------------------ | ---------- |
| `Doctor.userId`                   | `User`           | Exactly one user per doctor    | `Restrict` |
| `Staff.userId`                    | `User`           | Exactly one user per staff row | `Restrict` |
| `Doctor.departmentId`             | `Department`     | Exactly one department         | `Restrict` |
| `Staff.departmentId`              | `Department`     | Zero or one department         | `SetNull`  |
| `DoctorSchedule.doctorId`         | `Doctor`         | Exactly one doctor             | `Cascade`  |
| `DoctorScheduleBreak.scheduleId`  | `DoctorSchedule` | Exactly one schedule           | `Cascade`  |
| `DoctorLeave.doctorId`            | `Doctor`         | Exactly one doctor             | `Cascade`  |
| `DoctorUnavailability.doctorId`   | `Doctor`         | Exactly one doctor             | `Cascade`  |
| `Appointment.patientId`           | `Patient`        | Exactly one patient            | `Restrict` |
| `Appointment.doctorId`            | `Doctor`         | Exactly one doctor             | `Restrict` |
| `Appointment.createdById`         | `User`           | Zero or one creating user      | `SetNull`  |
| `Appointment.cancelledById`       | `User`           | Zero or one cancelling user    | `SetNull`  |
| `Appointment.rescheduledById`     | `User`           | Zero or one rescheduling user  | `SetNull`  |
| `Visit.appointmentId`             | `Appointment`    | Zero or one appointment        | `SetNull`  |
| `Visit.patientId`                 | `Patient`        | Exactly one patient            | `Restrict` |
| `Visit.doctorId`                  | `Doctor`         | Exactly one doctor             | `Restrict` |
| `Prescription.visitId`            | `Visit`          | Exactly one visit              | `Restrict` |
| `PrescriptionItem.prescriptionId` | `Prescription`   | Exactly one prescription       | `Cascade`  |
| `DiagnosticReport.visitId`        | `Visit`          | Exactly one visit              | `Restrict` |
| `Invoice.patientId`               | `Patient`        | Exactly one patient, required  | `Restrict` |
| `Invoice.visitId`                 | `Visit`          | Zero or one visit              | `Restrict` |
| `Invoice.appointmentId`           | `Appointment`    | Zero or one appointment        | `Restrict` |
| `InvoiceItem.invoiceId`           | `Invoice`        | Exactly one invoice            | `Cascade`  |
| `Payment.invoiceId`               | `Invoice`        | Exactly one invoice            | `Restrict` |
| `Payment.receivedById`            | `User`           | Zero or one receiving user     | `SetNull`  |
| `AuditLog.actorUserId`            | `User`           | Zero or one acting user        | `SetNull`  |
| `IdempotencyKey.actorUserId`      | `User`           | Exactly one acting user        | `Cascade`  |
| `RefreshToken.userId`             | `User`           | Exactly one token owner        | `Cascade`  |
| `RefreshToken.replacedByTokenId`  | `RefreshToken`   | Zero or one replacement token  | `SetNull`  |

`AuditLog.entityType` and `AuditLog.entityId` are a deliberate polymorphic reference.
They are not a foreign key because audit records may outlive the entity they describe.

## Aggregate boundaries

- **Master data:** `User`, `Patient`, `Department`, `Doctor`, and `Staff`.
- **Scheduling:** `DoctorSchedule`, `DoctorScheduleBreak`, `DoctorLeave`,
  `DoctorUnavailability`, and `Appointment`.
- **Clinical encounter:** `Visit`, `Prescription`, `PrescriptionItem`, and
  `DiagnosticReport`.
- **Revenue cycle:** `Invoice`, `InvoiceItem`, and `Payment`.
- **Cross-cutting control:** `AuditLog`, `IdempotencyKey`, and `RefreshToken`.

Clinical and billing records are always reached through `Visit`. This keeps a single
patient/doctor encounter as the source of truth while preserving historical records when a
patient, doctor, or user is deactivated. Hard deletion is restricted for clinical and
financial parents.
