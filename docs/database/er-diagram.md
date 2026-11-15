# Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o| DOCTOR : "has profile"
    USER ||--o| STAFF : "has profile"
    DEPARTMENT ||--o{ DOCTOR : "employs"
    DEPARTMENT ||--o{ STAFF : "assigns"
    DEPARTMENT ||--o{ APPOINTMENT : "groups"
    DOCTOR ||--o{ DOCTOR_SCHEDULE : "available"
    DOCTOR ||--o{ APPOINTMENT : "attends"
    DOCTOR ||--o{ ENCOUNTER : "documents"
    DOCTOR ||--o{ PRESCRIPTION : "prescribes"
    DOCTOR ||--o{ DIAGNOSTIC_REPORT : "orders"
    PATIENT ||--o{ APPOINTMENT : "books"
    PATIENT ||--o{ ENCOUNTER : "receives"
    PATIENT ||--o{ PRESCRIPTION : "receives"
    PATIENT ||--o{ DIAGNOSTIC_REPORT : "undergoes"
    PATIENT ||--o{ INVOICE : "billed"
    APPOINTMENT ||--o| APPOINTMENT_SLOT_RESERVATION : "reserves"
    APPOINTMENT ||--o| ENCOUNTER : "produces"
    APPOINTMENT ||--o{ INVOICE : "may generate"
    ENCOUNTER ||--o{ PRESCRIPTION : "includes"
    ENCOUNTER ||--o{ DIAGNOSTIC_REPORT : "includes"
    ENCOUNTER ||--o{ INVOICE : "may generate"
    INVOICE ||--o{ PAYMENT : "settled by"

    USER {
        ObjectId _id PK
        string email UK
        string passwordHash
        string role
        string status
    }
    PATIENT {
        ObjectId _id PK
        string patientId UK
        string firstName
        string lastName
        date dateOfBirth
        string gender
        string phone
        string status
    }
    DEPARTMENT {
        ObjectId _id PK
        string name UK
        string code UK
        ObjectId head FK
        string status
    }
    DOCTOR {
        ObjectId _id PK
        string doctorId UK
        ObjectId userId FK
        ObjectId department FK
        string specialization
        number consultationFee
        string status
    }
    STAFF {
        ObjectId _id PK
        string employeeId UK
        ObjectId userId FK
        ObjectId department FK
        string role
        string jobTitle
        string status
    }
    DOCTOR_SCHEDULE {
        ObjectId _id PK
        ObjectId doctor FK
        number dayOfWeek
        string startTime
        string endTime
        number slotDuration
        boolean isActive
    }
    APPOINTMENT {
        ObjectId _id PK
        string appointmentNumber UK
        ObjectId patient FK
        ObjectId doctor FK
        ObjectId department FK
        string date
        string startTime
        string endTime
        string status
    }
    APPOINTMENT_SLOT_RESERVATION {
        ObjectId _id PK
        ObjectId doctor FK
        string date
        string startTime
        ObjectId appointment FK
    }
    ENCOUNTER {
        ObjectId _id PK
        string encounterId UK
        ObjectId patient FK
        ObjectId doctor FK
        ObjectId appointment FK
        string chiefComplaint
        string status
    }
    PRESCRIPTION {
        ObjectId _id PK
        string prescriptionId UK
        ObjectId patient FK
        ObjectId doctor FK
        ObjectId encounter FK
        array medicines
    }
    DIAGNOSTIC_REPORT {
        ObjectId _id PK
        string reportId UK
        ObjectId patient FK
        ObjectId doctor FK
        ObjectId encounter FK
        string testName
        string status
    }
    INVOICE {
        ObjectId _id PK
        string invoiceNumber UK
        ObjectId patient FK
        ObjectId appointment FK
        ObjectId encounter FK
        number totalAmount
        number amountPaid
        number balanceDue
        string status
    }
    PAYMENT {
        ObjectId _id PK
        string paymentNumber UK
        ObjectId invoice FK
        number amount
        string method
        string status
    }
    AUDIT_LOG {
        ObjectId _id PK
        ObjectId actor FK
        string action
        string resourceType
        string resourceId
        string outcome
    }
    COUNTER {
        string _id PK
        number seq
    }
```

`AuditLog` and `Counter` are operational collections and are not connected by foreign keys. Audit entries reference actors and resources by loose IDs so they remain readable after business records change.
