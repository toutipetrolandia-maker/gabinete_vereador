# Security Specification - Gabinete Digital

## Data Invariants
1.  **Identity Spoofing Guard**: Users cannot set `usuario_id` or `role` to values other than their own authenticated ID and assigned role.
2.  **Immutability**: `created_at` and `usuario_id` cannot be changed after creation.
3.  **Audit Integrity**: The `logs` collection is write-only (create only). No updates or deletions allowed.
4.  **Role-Based Access Control (RBAC)**: 
    - `admin`: Full access (except sensitive audit deletion).
    - `vereador`: Full read access, can write to agenda and app settings.
    - `atendente`: Can create/update records but not delete or manage users.
    - `consulta`: Read-only access to specific collections.
5.  **Verified Email**: All writes require `request.auth.token.email_verified == true`.

## The Dirty Dozen Payloads (Rejection Tests)

| Payload ID | Target Collection | Intent | Reason for Rejection |
|------------|-------------------|--------|-----------------------|
| P1         | `users`           | Privilege Escalation: Update own role to 'admin' | `affectedKeys().hasOnly()` blocks `role` modification by non-admin |
| P2         | `atendimentos`    | Identity Spoofing: Create record as another user | `incoming().usuario_id == request.auth.uid` check fails |
| P3         | `logs`            | Evidence Tampering: Delete a log entry | `allow delete: if false` |
| P4         | `atendimentos`    | Data Corruption: Inject 1MB string into `protocolo` | `.size() <= 128` constraint fails |
| P5         | `users`           | Unauthorized Access: Read another user's private data | Only admins or owner can read private profile fields |
| P6         | `app_settings`    | Configuration Hijack: Update system lock as `atendente` | RBAC check fails (Requires `admin` or `vereador`) |
| P7         | `atendimentos`    | Bypass Validation: Update `status` without `updated_at` | `isValidAtendimento` requires server timestamp match |
| P8         | `atendimentos`    | Field Injection: Add `is_verified: true` to bypass logic | `affectedKeys().hasOnly()` blocks unknown fields |
| P9         | `atendimentos_medicos` | PII Leak: List all medical records as `consulta` | `allow list` requires specific owner/role context |
| P10        | `agenda_vereador` | Resource Exhaustion: Create 10,000 empty events | ID size and required field checks fail |
| P11        | `atendimentos`    | Path Poisoning: Use `../` or special chars in document ID | `isValidId()` regex check fails |
| P12        | `users`           | Identity Theft: Register with an unverified email | `email_verified == true` check fails |

## Test Runner (Draft)
A complete `firestore.rules.test.ts` will verify these cases against the rule engine.
