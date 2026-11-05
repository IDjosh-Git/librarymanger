# Library Manager · Registered Administrator Directory

**Updated behaviour:** The Administrators page lists all accounts whose email is confirmed and whose current server-side `library_member_roles.role` is `admin`, including accounts that selected Admin during registration and successfully activated the private code but have not recorded a subsequent visit. Selecting the Admin button alone never grants access. A manually authorised bootstrap administrator is also shown. Regular users and unconfirmed accounts are excluded.

The directory now uses a responsive six-column table on desktop and vertically organised rows on mobile: name/email, verified role, registration date, last recorded visit, visit count, and Remove. The Remove button demotes the selected admin to regular user, keeps their data, requires `REMOVE` confirmation, and blocks self-removal / last-admin removal. A new database trigger prevents revoked admins from using a previously shared code to re-promote themselves; a trusted database operator can explicitly restore them if needed.

## Database setup

If you **already installed** `library_admin_management_upgrade.sql`, run **only** `library_admin_signup_directory_fix.sql` in the correct Library Manager Supabase SQL editor. The full upgrade file is also updated for new installations; do not run both for an existing setup.

The SQL is packaged but **not applied to your live database**. The updated frontend must also be deployed. Do not expose any Supabase service-role key in browser code.

## Verification

The static and application test suite checks roles, admin listing without activity, secure removal, responsive table, and preserved access-code signup workflow. A live test with two distinct Admin accounts is still required after database deployment.
