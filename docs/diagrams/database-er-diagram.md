# Database ER Diagram

```mermaid
flowchart LR
    User -->|1:1| Doctor
    User -->|1:1| Staff
    Department -->|1:*| Doctor
    Department -->|1:*| Staff
    Department -->|1:*| Appointment
    Doctor -->|1:*| DoctorSchedule
    Doctor -->|1:*| Appointment
    Doctor -->|1:*| Encounter
    Doctor -->|1:*| Prescription
    Doctor -->|1:*| DiagnosticReport
    Patient -->|1:*| Appointment
    Patient -->|1:*| Encounter
    Patient -->|1:*| Prescription
    Patient -->|1:*| DiagnosticReport
    Patient -->|1:*| Invoice
    Appointment -->|1:0..1| AppointmentSlotReservation
    Appointment -->|1:0..1| Encounter
    Appointment -->|1:*| Invoice
    Encounter -->|1:*| Prescription
    Encounter -->|1:*| DiagnosticReport
    Encounter -->|1:*| Invoice
    Invoice -->|1:*| Payment
```

The authoritative field-level model and constraints are in [the data dictionary](../database/data-dictionary.md) and [relationships](../database/relationships-and-constraints.md). A full Mermaid `erDiagram` is available in [database/er-diagram.md](../database/er-diagram.md).
