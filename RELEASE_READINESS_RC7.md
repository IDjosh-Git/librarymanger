# Library Manager v6 RC7 — consolidated integration checkpoint

## Built and tested
- Shared Review editing lease client and backend RPCs; strict trigger supplied separately for coordinated activation.
- Inventory data-quality reports and operational dashboard.
- Member reservations, return-to-waitlist handoff, notification outbox.
- Scheduled Resend email worker with atomic, `SKIP LOCKED` delivery claims (migration 20 required).
- Weekly management report enqueue (Monday UTC), explicit REPORT_TO_EMAIL destination.
- Secret-protected operations health endpoint.
- Weekly Book of the Week cron retained.
- 231 Node automated tests passing.

## Deployment dependencies and boundaries
1. Apply migration `database/20_delivery_claim_and_reporting.sql` to Supabase before deploying the updated worker. Migration 21 is *not* automatically applied; coordinate it with the frontend rollout.
2. Configure Vercel `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `REPORT_TO_EMAIL`; verify sender domain and email delivery. Never place service keys in browser source.
3. Deploy Vercel, verify `/api/operations-health` using CRON_SECRET, then run an authorized operations-cron invocation and inspect the outbox.
4. Verify live two-admin Review editing, reservations, returns, and weekly-pick behavior before activating migration 21.
5. Borrower email identity is *not* verified; overdue/due-soon email delivery remains intentionally blocked. Do not infer borrower from loan.user_id.
6. Inventory auto-correction remains manual to avoid destructive edits. Backup snapshots and restore drills require project-level backup configuration and testing.
7. A passing automated suite is not proof of live end-to-end or visual QA. No production deployment or email delivery has been performed in this checkpoint.
