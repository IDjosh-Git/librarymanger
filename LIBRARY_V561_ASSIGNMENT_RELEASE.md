# Library Manager v5.61 — Optional shared Review assignment

## Included
- Admin-only, database-serialized allocation of the oldest unassigned pending Review item.
- Fifteen-minute assignment expiry, explicit release, and optional renewal RPC.
- Existing assignment reused when an administrator requests another item.
- Review page controls to claim/release a book, plus assigned-record indicator.
- Preserves v5.60 approval leases, previous branding, review filters and reconciliation export.

## Required deployment
1. Run earlier migrations through `14_review_approval_leases.sql` if not already installed.
2. Run `database/15_review_assignment.sql` in Supabase SQL Editor.
3. Deploy the application and verify with two separate admin accounts.
4. Confirm that only one admin can claim a given item at a time and that assignments expire after 15 minutes.

## Limitations
- Assignment is **work allocation**, not an enforced editing lock. Editing by other administrators remains possible; approval leases from v5.60 still protect only the approval flow.
- Assignment renewal is available server-side but automatic heartbeat is not enabled in this release. Reclaim after expiry.
- No production deployment or live database migration was performed.
- The other requested automations (lending reminders, reservations, scheduled reporting, backup/recovery, etc.) are not implemented by this release.
