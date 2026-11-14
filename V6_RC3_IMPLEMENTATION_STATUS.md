# Library Manager v6 RC3 — implementation status

This release adds an **additive database migration** for reservations, a notification outbox, due-date notice generation, and an administrator operations snapshot. It does **not** automatically deliver emails/SMS, run scheduled jobs, complete return-to-reservation handoffs, or implement tested end-to-end reservations UI. These require deployment configuration and integration.

## Safety
- Do not apply strict Review edit trigger until the updated frontend is deployed and older clients are retired.
- The outbox contains notification payloads but no sender; configure a secure server-side worker and verified email/SMS provider.
- Backups must be configured at the hosting/database layer and restore-tested.
- Validate reservation policies and book availability against real accounts before production rollout.
- The migration is not applied to live Supabase in this package.

## Existing features
The existing application includes scan, shared Review, Inventory, lending/returns, weekly spotlight, and customizable branding. Their production readiness requires live multi-user integration tests.
