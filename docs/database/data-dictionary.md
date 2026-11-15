# Data Dictionary

MongoDB collections are created from the Mongoose models in `backend/src/models`. All documents include `_id` and `createdAt`/`updatedAt` unless noted. Monetary values are stored as decimal numbers representing currency units and rounded to two decimals by server helpers; they are not integer cents or `BigInt`.

## User

| Field | Type | Rules |
|---|---|---|
| `firstName`, `lastName` | String | Required, max 80 |
| `email` | String | Required, unique, lowercase |
| `passwordHash` | String | Required, `select: false`, bcrypt |
| `role` | String | `ADMIN`, `RECEPTIONIST`, `DOCTOR` |
| `status` | String | `ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `phone` | String | Optional |
| `lastLoginAt` | Date | Updated on login |

## Patient

| Field | Type | Rules |
|---|---|---|
| `patientId` | String | Required, unique, `PAT-######` |
| `firstName`, `lastName` | String | Required, max 80 |
| `dateOfBirth` | Date | Required |
| `gender` | String | `MALE`, `FEMALE`, `OTHER` |
| `phone` | String | Required |
| `email` | String | Optional, lowercase |
| `address` | Object | `line1`, `city`, `state`, `postalCode` |
| `emergencyContact` | Object | `name`, `phone`, `relationship` |
| `bloodGroup` | String | `A_POSITIVE` … `O_NEGATIVE`, `UNKNOWN` |
| `registrationDate` | Date | Defaults to now |
| `status` | String | `ACTIVE`, `INACTIVE` |
| `createdBy` | ObjectId → User | Optional |

## Department

| Field | Type | Rules |
|---|---|---|
| `name` | String | Required, unique |
| `code` | String | Required, unique, uppercase |
| `description` | String | Max 1000 |
| `location`, `phone` | String | Optional |
| `head` | ObjectId → Doctor | Optional |
| `status` | String | `ACTIVE`, `INACTIVE` |

## Doctor

| Field | Type | Rules |
|---|---|---|
| `doctorId` | String | Required, unique, `DOC-######` |
| `userId` | ObjectId → User | Required, unique |
| `department` | ObjectId → Department | Required |
| `firstName`, `lastName` | String | Required, max 80 |
| `email` | String | Required, unique, lowercase |
| `phone` | String | Optional |
| `specialization`, `qualification` | String | Required |
| `experienceYears` | Number | 0–70 |
| `consultationFee` | Number | ≥ 0 |
| `workingDays` | [Number] | Weekdays `0`–`6`, default Mon–Fri |
| `workingHours` | Object | `start`, `end` as `HH:mm` |
| `appointmentDuration` | Number | 10–120 minutes |
| `status` | String | `ACTIVE`, `ON_LEAVE`, `INACTIVE` |
| `bio` | String | Max 1000 |

## Staff

| Field | Type | Rules |
|---|---|---|
| `employeeId` | String | Required, unique, `EMP-######` |
| `userId` | ObjectId → User | Required, unique |
| `department` | ObjectId → Department | Optional |
| `firstName`, `lastName` | String | Required |
| `email` | String | Required, unique |
| `phone` | String | Optional |
| `role` | String | `ADMIN`, `RECEPTIONIST` |
| `jobTitle` | String | Required |
| `joiningDate` | Date | Defaults to now |
| `status` | String | `ACTIVE`, `ON_LEAVE`, `INACTIVE`, `TERMINATED` |

## DoctorSchedule

| Field | Type | Rules |
|---|---|---|
| `doctor` | ObjectId → Doctor | Required |
| `dayOfWeek` | Number | `0` Sunday … `6` Saturday |
| `startTime`, `endTime` | String | `HH:mm` |
| `slotDuration` | Number | 10–120 minutes |
| `room` | String | Optional |
| `isActive` | Boolean | Default `true` |

Unique index: `(doctor, dayOfWeek, startTime)`.

## Appointment

| Field | Type | Rules |
|---|---|---|
| `appointmentNumber` | String | Required, unique, `APT-######` |
| `patient` | ObjectId → Patient | Required |
| `doctor` | ObjectId → Doctor | Required |
| `department` | ObjectId → Department | Required |
| `date` | String | `YYYY-MM-DD` |
| `startTime`, `endTime` | String | `HH:mm` |
| `appointmentType` | String | `CONSULTATION`, `FOLLOW_UP`, `EMERGENCY` |
| `consultationFee` | Number | Captured from doctor |
| `status` | String | Appointment status enum |
| `reason`, `notes` | String | Optional |
| `createdBy` | ObjectId → User | Optional |
| `cancelledBy`, `cancelledAt`, `cancellationReason` | Mixed | Set on cancellation |
| `rescheduledAt`, `rescheduledBy` | Mixed | Set on reschedule |

## AppointmentSlotReservation

| Field | Type | Rules |
|---|---|---|
| `doctor` | ObjectId → Doctor | Required |
| `date` | String | `YYYY-MM-DD` |
| `startTime`, `endTime` | String | `HH:mm` |
| `appointment` | ObjectId → Appointment | Optional until linked |

Unique index: `(doctor, date, startTime)`.

## Encounter

| Field | Type | Rules |
|---|---|---|
| `encounterId` | String | Required, unique, `ENC-######` |
| `patient` | ObjectId → Patient | Required |
| `doctor` | ObjectId → Doctor | Required |
| `appointment` | ObjectId → Appointment | Optional, unique sparse |
| `encounterDate` | Date | Defaults to now |
| `visitType` | String | `CONSULTATION`, `FOLLOW_UP`, `EMERGENCY` |
| `chiefComplaint` | String | Required, max 1000 |
| `clinicalNotes`, `treatmentNotes` | String | Max 10000 |
| `vitalSigns` | Object | Temperature, BP, heart rate, weight, height, SpO₂ |
| `followUpDate` | Date | Optional |
| `status` | String | `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `createdBy` | ObjectId → User | Optional |

## Prescription

| Field | Type | Rules |
|---|---|---|
| `prescriptionId` | String | Required, unique, `RX-######` |
| `patient` | ObjectId → Patient | Required |
| `doctor` | ObjectId → Doctor | Required |
| `encounter` | ObjectId → Encounter | Required |
| `prescriptionDate` | Date | Defaults to now |
| `medicines` | Array | At least one medicine |
| `notes` | String | Max 2000 |
| `createdBy` | ObjectId → User | Optional |

Medicine fields: `name`, `dosage`, `frequency`, `duration` (required) and `instructions` (optional).

## DiagnosticReport

| Field | Type | Rules |
|---|---|---|
| `reportId` | String | Required, unique, `DR-######` |
| `patient` | ObjectId → Patient | Required |
| `doctor` | ObjectId → Doctor | Required |
| `encounter` | ObjectId → Encounter | Optional |
| `testName`, `testCategory` | String | Required |
| `reportDate` | Date | Defaults to now |
| `status` | String | `ORDERED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `notes` | String | Max 5000 |
| `fileReference` | String | Max 500 |
| `createdBy` | ObjectId → User | Optional |

## Invoice

| Field | Type | Rules |
|---|---|---|
| `invoiceNumber` | String | Required, unique, `INV-######` |
| `patient` | ObjectId → Patient | Required |
| `appointment`, `encounter` | ObjectId | Optional links |
| `invoiceDate`, `dueDate` | Date | Dates |
| `lineItems` | Array | At least one item |
| `subtotal` | Number | Server-calculated |
| `taxRate` | Number | 0–100 percent |
| `tax` | Number | Server-calculated |
| `discount` | Number | ≥ 0 |
| `totalAmount` | Number | Server-calculated |
| `amountPaid` | Number | Accumulated payments |
| `balanceDue` | Number | Outstanding balance |
| `status` | String | Invoice status enum |
| `notes` | String | Max 2000 |
| `createdBy` | ObjectId → User | Optional |

Line item fields: `description`, `category`, `quantity`, `unitPrice`, `amount`.

## Payment

| Field | Type | Rules |
|---|---|---|
| `paymentNumber` | String | Required, unique, `PAY-######` |
| `invoice` | ObjectId → Invoice | Required |
| `amount` | Number | ≥ 0.01 |
| `method` | String | `CASH`, `CARD`, `UPI`, `INSURANCE`, `OTHER` |
| `status` | String | `SUCCESS`, `FAILED`, `REFUNDED` |
| `transactionRef` | String | Unique sparse |
| `idempotencyKey` | String | Unique sparse |
| `receivedBy` | ObjectId → User | Optional |
| `paidAt` | Date | Defaults to now |
| `notes` | String | Max 500 |
| `simulated` | Boolean | Default `true` |

## AuditLog

| Field | Type | Rules |
|---|---|---|
| `actor` | ObjectId → User | Optional for failed login |
| `actorRole` | String | Snapshot of role |
| `action` | String | Required, indexed |
| `resourceType` | String | Required |
| `resourceId` | String | Human-readable ID or ObjectId |
| `outcome` | String | `SUCCESS`, `FAILURE` |
| `metadata` | Mixed | Action-specific details |
| `ipAddress`, `userAgent`, `requestId` | String | Request context |

Only `createdAt` is stored. Updates and deletes are blocked by model middleware.

## Counter

| Field | Type | Rules |
|---|---|---|
| `_id` | String | Counter name, e.g. `patient` |
| `seq` | Number | Last issued sequence |

Used by `nextId` to generate human-readable identifiers atomically.

## Enumerations

- Roles: `ADMIN`, `RECEPTIONIST`, `DOCTOR`
- User status: `ACTIVE`, `INACTIVE`, `SUSPENDED`
- Patient status: `ACTIVE`, `INACTIVE`
- Doctor status: `ACTIVE`, `ON_LEAVE`, `INACTIVE`
- Staff status: `ACTIVE`, `ON_LEAVE`, `INACTIVE`, `TERMINATED`
- Appointment type: `CONSULTATION`, `FOLLOW_UP`, `EMERGENCY`
- Appointment status: `BOOKED`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`
- Encounter/visit type: `CONSULTATION`, `FOLLOW_UP`, `EMERGENCY`
- Encounter status: `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- Report status: `ORDERED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- Invoice status: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`, `CANCELLED`
- Payment status: `SUCCESS`, `FAILED`, `REFUNDED`
- Payment method: `CASH`, `CARD`, `UPI`, `INSURANCE`, `OTHER`
- Genders: `MALE`, `FEMALE`, `OTHER`
- Blood groups: `A_POSITIVE`, `A_NEGATIVE`, `B_POSITIVE`, `B_NEGATIVE`, `AB_POSITIVE`, `AB_NEGATIVE`, `O_POSITIVE`, `O_NEGATIVE`, `UNKNOWN`
