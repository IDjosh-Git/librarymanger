# Library Manager v6 RC6 — Scheduled notification worker

Implemented: Vercel daily cron endpoint `/api/operations-cron`, protected by `CRON_SECRET`, Supabase server-only access, Resend email dispatch for reservation-available notifications, idempotency keys, retry backoff, sent/failed tracking, and automated authorization tests.

**Not production-complete:** `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL` must be configured on Vercel. Cron is not deployed. No emails were sent. Loan `user_id` cannot safely be assumed to be the borrower's identity; overdue/due-soon emails are deliberately blocked until a verified borrower-to-email mapping exists. Delivery-worker concurrency requires an atomic claim RPC before scale-out. Review editing guard, scheduled reports, backups, restore drills, branding QA, and two-admin/browser end-to-end tests remain pending.

The weekly-pick cron already exists in vercel.json and requires its own environment configuration.
