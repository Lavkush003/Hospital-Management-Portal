# Appointment Booking Sequence

```mermaid
sequenceDiagram
    autonumber
    actor R as Receptionist
    participant UI as Appointments page
    participant API as Express API
    participant DB as MongoDB

    R->>UI: Select patient, doctor and date
    UI->>API: GET /doctors/:id/availability?date=YYYY-MM-DD
    API->>DB: Load active schedule blocks for weekday
    API->>DB: Load slot reservations and non-cancelled appointments
    DB-->>API: Blocked start times
    API-->>UI: Slots with available flags

    R->>UI: Choose an available slot and submit
    UI->>API: POST /appointments {patient, doctor, date, startTime, ...}
    API->>DB: Verify patient exists and is ACTIVE
    API->>DB: Verify doctor exists and is ACTIVE

    API->>DB: Find schedule covering the slot
    API->>API: Verify alignment, duration and not in the past
    API->>DB: Check overlapping non-cancelled appointments
    alt slot unavailable
        API-->>UI: 400 OUTSIDE_WORKING_HOURS / SLOT_MISALIGNED / 409 SLOT_TAKEN
    else slot available
        API->>DB: Insert unique slot reservation
        alt reservation conflict
            API-->>UI: 409 SLOT_TAKEN
        else reservation acquired
            API->>DB: Generate APT number and insert appointment
            API->>DB: Link reservation to appointment
            API->>DB: Append APPOINTMENT_BOOKED audit log
            API-->>UI: 201 appointment
            UI-->>R: Success toast and refreshed list
        end
    end
```

## Failure handling

- If appointment creation fails after the reservation is acquired, the reservation is deleted so the slot is immediately reusable.
- Rescheduling reserves the new slot first, saves the appointment, then releases the old reservation. If saving fails, the new reservation is released.
- Cancellation deletes all reservations for the appointment.
- A completed appointment keeps its reservation so the historical slot remains unavailable for rebooking.
