# Library Manager — Administrator Management (5 November 2026)

## What is included

- New **Admin management** page/panel inside the existing Library Manager application, accessible from the desktop sidebar and mobile navigation, with premium light/dark styling, activity cards, search and last-use timestamps.
- Only **administrators who have actually opened the Library Manager app after this update** appear in its directory. A mere Supabase `auth.users` record or activity in another application does **not** qualify.
- **Remove access** asks for an explicit `REMOVE` confirmation. It **demotes the role from `admin` to `user`** rather than deleting the person, account, inventory, or loan records.
- Safety guards are enforced by Supabase functions: admin authorization, no self-removal, no last-admin removal, no removal of admin accounts lacking Library Manager visit records, and no reclaiming a revoked role through a previously issued administrator code or invitation.
- App-specific visits are recorded after verified administrator role checks, and updated during active navigation at a throttled rate. Ordinary users and anonymous visitors are not added to the admin directory.

## Install

1. The Supabase migration `library_admin_management_upgrade.sql` has been applied **to the connected project `hotysnqorkqbiconjskl`**, the same URL configured in this source package. It did **not** delete or demote any existing admin.
2. Deploy the full updated project from this ZIP to the Library Manager website. **Do not upload it to your DataLearning repository.**
3. Sign in as an existing Library Manager administrator. Open **Access Control → Admin management**. The admin is recorded when entering the updated app, then appears in the directory.
4. Another admin must enter the updated app before they will appear in the list. Then, select **Remove access** and type `REMOVE` to confirm. The current user cannot remove themselves.
5. If this ZIP is deployed to another Supabase project, apply the SQL migration to that project first through Supabase SQL Editor with database-owner privileges. The migration assumes the existing Library Manager role system (`public.library_member_roles`) is installed.

## Safety and recovery

- The backend denies unauthorized and anonymous directory access and removal calls. Email addresses are returned only after checking the caller's admin role.
- The database maintains a `private.library_admin_revocations` record after removal, preventing the removed person from self-reinstating using an old code. An authorized database operator must explicitly clear this record **before** deliberately restoring admin role access. Admin Management does not contain a restore control.
- Existing signed-in pages may continue showing admin navigation until refreshed, but Supabase role policies and the new admin RPCs recheck the authoritative role for every protected request. Sign out/in after a role change to refresh the UI.
- The directory's activity history begins with **this release**. It does not import past sign-ins from Auth because the Supabase project is also used by other applications; those events cannot reliably establish a Library Manager visit.

## Verification

- 61 Python regression tests passed, including 5 new Admin Management checks; Node syntax checks and existing scan-integration tests passed.
- Chromium mocked-data tests at 320px, 390px, 768px and 1440px found no page-level horizontal overflow. A mocked Remove action updated the list; **no live administrator was removed**.
- Supabase migration installed and checked. The role table still contained its existing three administrators immediately after the installation; the new app visit table was empty until a user enters the updated app.

**Deployment note:** The SQL backend is installed on the connected project, but the updated frontend is not live until you publish the ZIP contents to the Library Manager deployment.
