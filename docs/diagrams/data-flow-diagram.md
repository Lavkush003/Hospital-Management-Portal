# Data Flow Diagram

## Patient booking flow

```mermaid
flowchart LR
    R[Receptionist] -->|search patient| UI[Patients page]
    UI -->|GET /patients| API[Express API]
    API --> DB[(MongoDB)]

    R -->|select doctor and date| AP[Appointments page]
    AP -->|GET /doctors/:id/availability| API
    API -->|schedules + reservations + appointments| DB
    API -->|available slots| AP

    R -->|book slot| AP2[POST /appointments]
    AP2 --> API
    API -->|validate patient, doctor, schedule, slot| DB
    API -->|reserve slot| RES[(AppointmentSlotReservation)]
    API -->|create appointment| APT[(Appointment)]
    API -->|audit APPOINTMENT_BOOKED| AUD[(AuditLog)]
    API -->|201 appointment| AP
```

## Clinical flow

```mermaid
flowchart LR
    D[Doctor] -->|open appointment| UI[Appointments page]
    UI -->|POST /encounters| API[Express API]
    API -->|verify doctor ownership and unique appointment| DB[(MongoDB)]
    API -->|create encounter, set appointment IN_PROGRESS| DB
    API -->|audit| DB

    D -->|record vitals and notes| UI2[Encounters page]
    UI2 -->|PUT /encounters/:id| API
    D -->|prescribe medicines| UI3[Prescriptions page]
    UI3 -->|POST /prescriptions| API
    D -->|order or complete test| UI4[Diagnostic reports page]
    UI4 -->|POST or PUT /diagnostic-reports| API
    API -->|ownership, encounter linkage| DB
```

## Billing flow

```mermaid
flowchart LR
    R[Receptionist] -->|create invoice| UI[Billing page]
    UI -->|POST /invoices| API[Express API]
    API -->|recalculate line items, discount, tax| API
    API -->|create invoice| INV[(Invoice)]
    API -->|audit| AUD[(AuditLog)]

    R -->|record payment| UI2[Invoice detail]
    UI2 -->|POST /invoices/:id/payments| API
    API -->|check outstanding balance| INV
    API -->|create payment| PAY[(Payment)]
    API -->|atomically update paid/balance/status| INV
    API -->|audit PAYMENT_RECORDED| AUD
```

## Dashboard and reporting flow

```mermaid
flowchart LR
    U[User] -->|open dashboard| UI[Dashboard page]
    UI -->|GET /dashboard/{admin|receptionist|doctor}| API[Express API]
    API -->|aggregate patients, appointments, revenue, activity| DB[(MongoDB)]
    API -->|summary cards and recent lists| UI

    A[Admin] -->|filter reports| RP[Reports page]
    RP -->|GET /reports/*| API
    API -->|aggregate by date, doctor, department| DB
    API -->|chart-ready data| RP
```

## Login flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant API as Express API
    participant DB as MongoDB
    B->>API: POST /auth/login {email, password}
    API->>DB: Find user by email
    DB-->>API: User with password hash
    API->>API: bcrypt.compare
    alt invalid
        API->>DB: Audit failed login
        API-->>B: 401 INVALID_CREDENTIALS
    else valid
        API->>DB: Update lastLoginAt, audit success
        API->>API: Sign JWT
        API-->>B: Set httpOnly cookie + accessToken
        B->>API: GET /auth/me with Bearer
        API-->>B: Safe user and doctor profile
    end
```
