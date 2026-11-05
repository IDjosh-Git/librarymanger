# Library Manager — Admin Management (5 Nov 2026)

## New screen

- **Administrators** in the desktop workspace menu and mobile More menu.
- Lists only members whose current `library_member_roles.role` is `admin` **and** who have registered real activity in this Library Manager app through the server-validated `library_register_admin_visit` RPC.
- Displays their name, email, first recorded visit, latest recorded visit and the number of recorded entries. Includes search, refresh, a responsive card layout and dark/light theme support.
- Current admin is labelled **YOU · ADMIN** and cannot be removed.

## Safely remove an administrator

1. Open **Administrators** while signed in with an administrator account.
2. Select **Remove admin access** for another administrator.
3. Type `REMOVE` in the confirmation field and submit.
4. The server checks your current role, refuses self-removal and protects the last administrator. On success the target becomes a **regular user**, preserving their Supabase Auth account, books, circulation records and history.
5. Revocations are stored in a separate audit table for accountability.

**Note:** Administrators that exist in Supabase but have **not** accessed this application since tracking was enabled **will not be listed**. This is intentional. Active signed-in admins begin appearing after they open the deployed application. The list is not based solely on a Supabase account's creation or login timestamp.

## Required Supabase setup

Apply `library_admin_management_upgrade.sql` in the correct Library Manager Supabase project **after** the existing role migration. Review it first and back up important data. The update is additive: no existing users are removed or demoted when installing.

- `library_admin_activity`: records verified in-app administrator usage, not arbitrary accounts.
- `library_admin_role_audit`: logs administrator revocations.
- `library_register_admin_visit`: validates current role and tracks in-app access.
- `library_list_active_admins`: admin-only directory of actual app visitors.
- `library_revoke_admin`: admin-only revocation with self/last-admin protections.

All tables are RLS-protected and not directly available to ordinary browser data queries. Only the protected RPCs expose relevant operations. Do not add a service-role key to client-side code.

After granting a new administrator their role via the existing registration/access-code process, they must visit the app to appear in the list. Revoked administrators with an existing browser session may still have the old navigation visible until refreshing, but server access policies check their current database role and reject privileged operations. Rotate outstanding admin access codes or invitations when access must be tightly controlled.

## Verification

- 61 Python tests passed.
- Browser JavaScript inline syntax validated with Node.js.
- UI is wired into role-aware desktop and mobile navigation.
- **Not yet validated in live Supabase or on Vercel.** Apply the SQL upgrade and deploy the new ZIP before testing with two distinct administrator accounts.
