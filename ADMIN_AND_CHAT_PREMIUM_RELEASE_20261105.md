# Library Manager — Admin Directory + Workspace & Reader Chat Refresh

## What changed
- Administrators screen continues to list **confirmed, server-authorised Admin accounts** using the existing `library_list_active_admins` RPC; a completed Admin role registration is visible without any recorded visits.
- An admin who only clicked the Admin registration option, but did not complete access-code/email verification, does **not** appear because they are not authorised.
- The **Remove admin** button continues to use the authenticated `library_revoke_admin` server function, and now has clearer copy and refined design. It demotes the target to a regular library user; it never deletes a login or data.
- Existing server protections remain: self-removal blocked, last-admin removal blocked, concurrent revocations serialised, actions audited.
- **Your workspace** entire authenticated navigation card has a modern indigo-and-off-white design, layered account badge, coherent selected state, readable contrast and dark-theme overrides.
- **Book Guide** floating chat has a new navy-violet header, updated message bubbles, refined book dropdown, suggestion chips, high-contrast input and Send control, along with mobile scaling.

## Database and deployment
The connected project was checked on November 5, 2026: `library_list_active_admins()` and `library_revoke_admin(uuid)` exist; the active functions include role-based listing, self-removal prevention, concurrency handling and audit logging. **No SQL migration was executed** as part of this UI release. SQL setup scripts remain included for new instances. Do not apply the same database migrations repeatedly if your database is already configured.

Publish the updated Library Manager files to your deployment. This source package does not deploy itself. Confirm the administrator directory from a real verified admin login and removal using two test administrator accounts before using the action on live staff accounts.

## Verification
- 65 Python application regression tests passed.
- Node scanning integration tests passed.
- Chromium static UI checks at 390, 768 and 1440px passed without page-width overflow, including the visible **Remove admin** action and opening of Book Guide.
- Browser screenshots show simulated users and are not a claim that a live administrator account was modified.
