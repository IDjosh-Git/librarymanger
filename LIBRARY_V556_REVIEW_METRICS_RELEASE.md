# Library Manager v5.56 — Shared Review workload visibility

Incremental release built on v5.55. The shared Review advanced-tools card now displays live cloud-derived counts: pending books across administrators, contributing uploaders, books missing titles, and records not updated for 24 hours. Metrics are refreshed when the shared Review queue is synchronized and clearly indicate offline state. No inventory records or review ownership are modified by this feature.

## Deployment
Deploy the application files after completing the existing v5.55 branding migration (`database/13_shared_branding.sql`). This release adds no database migration. Confirm the four metrics against Supabase Review records using two administrator accounts. No live deployment or database changes were performed in this workspace.

## Scope
This is **not** implementation of all proposed automations. Automated assignment/locking, reconciliation, lending notifications, reservations, backups, and scheduled jobs remain outstanding. The metrics show uploaders, not assigned reviewers.

## Verification
`npm test`: 201 passed, 0 failed (static/unit tests; not live Supabase or browser end-to-end testing).
