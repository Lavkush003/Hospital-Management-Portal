# Role Permission Matrix

| Capability | Admin | Receptionist | Doctor |
|---|:---:|:---:|:---:|
| Login / own profile / change password | Yes | Yes | Yes |
| Admin dashboard | Yes | No | No |
| Receptionist dashboard | Yes | Yes | No |
| Doctor dashboard | No | No | Yes |
| List/read patients | Yes | Yes | Assigned only |
| Create/update patients | Yes | Yes | No |
| Change patient status | Yes | No | No |
| View patient history | Yes | Yes | Assigned only |
| List/read doctors | Yes | Yes | Yes |
| Create/update doctors | Yes | No | No |
| Change doctor status | Yes | No | No |
| Read doctor availability | Yes | Yes | Yes |
| List/read departments | Yes | Yes | Yes |
| Create/update/delete departments | Yes | No | No |
| Staff management | Yes | No | No |
| Read schedules | Yes | Yes | Yes |
| Create/update/delete schedules | Yes | No | No |
| List/read appointments | Yes | Yes | Own only |
| Create appointments | Yes | Yes | No |
| Update/reschedule appointments | Yes | Yes | Own only |
| Change appointment status | Yes | Yes, except IN_PROGRESS/COMPLETED | Own only |
| Cancel appointments | Yes | Yes | Own only |
| Read encounters | Yes | No | Own only |
| Create/update encounters | No | No | Own only |
| Read prescriptions | Yes | No | Own only |
| Create/update prescriptions | No | No | Own only |
| Read diagnostic reports | Yes | No | Own only |
| Create reports | No | No | Own only |
| Update reports | Yes | No | Own only |
| List/read invoices | Yes | Yes | No |
| Create invoices | Yes | Yes | No |
| Record payments | Yes | Yes | No |
| List/read payments | Yes | Yes | No |
| Reports | Yes | No | No |
| Audit logs | Yes | No | No |

## Enforcement points

- `authenticate` validates the JWT and loads the active user.
- `authorize(...roles)` applies coarse role checks at the route.
- Services apply fine-grained ownership checks for doctors and assign doctor IDs on writes.
- The frontend mirrors this matrix in `RoleRoute` and `AppLayout` but is not a security boundary.

## Doctor access to patients

A doctor may access a patient when at least one of these exists:

- An appointment between that doctor and patient.
- An encounter between that doctor and patient.

This scope is used for patient detail, patient history and new encounters not linked to an appointment.
