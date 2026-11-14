# Library Manager v6 RC4 — integration checkpoint

## Implemented and tested locally
- Automation Centre live operations snapshot via `library_admin_operations_snapshot`.
- Administrator action to queue due-date reminders using `library_queue_due_notices`.
- Read-only administrator waiting-reservations view.
- New tests; 225/225 Node tests passing.

## Applied to connected Supabase DataLearning
- `library_reservations` with RLS and unique active-reservation protection.
- `library_notification_outbox` with deduplicated event keys and private access.
- `library_queue_due_notices(date)` and `library_admin_operations_snapshot()` RPCs, authenticated administrators only.

## Outstanding — do not claim production completion
- No deployed web frontend or verified two-admin end-to-end tests.
- No member-facing reservation creation/cancellation UI.
- No return-to-reservation automatic handoff.
- No external email/SMS provider or scheduled worker: notifications are queued, not delivered.
- No verified automated weekly spotlight schedule, scheduled report delivery, backup/restore, or alerts.
- Strict Review edit-enforcement trigger remains inactive pending coordinated frontend rollout.
- Branding consistency requires cross-device visual testing.

## Security notes
- Notification outbox has RLS and no direct client grants.
- Privileged RPCs require an authenticated administrator.
- Existing migration `18_operations_automation_foundation.sql` is a historical draft; the live migration tightens auth checks and active-reservation uniqueness. Do not reapply the draft to production.
