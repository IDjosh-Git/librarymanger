# Library Manager v6.0 RC2 — Shared Review editing locks

The Review UI requests an exclusive, renewable 15-minute edit lease when an administrator focuses a book field. If the claim fails, the fields remain disabled and the user sees a conflict message. Approval requires renewal of the same lease. A database trigger prevents updates to pending Review metadata unless the authenticated editor holds the lease.

## Deployment order and limitations

1. **Do not run `database/17_review_edit_locks.sql` on the live database before deploying the matching RC2 frontend.** The trigger intentionally rejects legacy clients that update Review data without first claiming a lock. Deploy frontend and database changes in a coordinated maintenance window.
2. Back up the database, run the migration, deploy the RC2 frontend, and require all administrators to refresh.
3. Test two simultaneous administrator sessions on the same record, expiry, renewal, save, and mobile focus behavior.
4. This release does not enforce a lock for all other actions (e.g. bulk correction, AI auto-fill, deletion). These must be audited before production use. Background sync from older versions will fail on locked metadata edits.
5. Existing approval leases remain a separate safeguard.

No production deployment or database migration was performed as part of packaging RC2.
