# Library Manager v6 RC5 — reservation integration

Implemented:
- Member-facing reservation form and personal reservations list, with cancellation of waiting reservations.
- Authenticated member identity comes from Supabase Auth; RLS constrains inserts and reads.
- Supabase return trigger promotes the earliest waiting reservation and enqueues a reservation_available notification, once per reservation.
- Existing RC4 operational dashboard, due-date queue, inventory exports and Review workflows retained.

Not yet complete:
- Queued messages are **not delivered**. An authenticated server-side notification worker and provider credentials are required.
- Weekly spotlight automatic scheduling, scheduled reports, automated backup/restore, full Review lock enforcement and production deployment remain unverified.
- This release has not been browser-tested against two independent member sessions.
