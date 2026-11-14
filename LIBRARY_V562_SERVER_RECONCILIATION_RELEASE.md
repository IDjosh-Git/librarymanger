# Library Manager v5.62 — Server-side Review reconciliation foundation

- Adds an administrator-only RPC, `library_review_reconciliation_metrics`, returning pending, missing-title, stale, unassigned, and duplicate-key counts directly from Supabase.
- Read-only: does not approve, delete, or alter any book.
- Explicitly removes anonymous EXECUTE permissions on the v5.61 assignment RPCs.
- This is a backend foundation. Existing browser reconciliation export remains unchanged; the new RPC is not yet wired to a UI widget.
- Migration: `database/16_review_reconciliation_metrics.sql`.
- Pending: complete edit locking, automated inventory cross-check, lending notifications, reservations, scheduled jobs, backups, and monitoring.
