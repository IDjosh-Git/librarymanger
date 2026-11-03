# Library Manager — Direct Administrator / User Registration

## What changed

- A shared entry screen: **Sign In** accepts only email/password; **Create Account** offers **Library user** and **Administrator** choices.
- New users selecting **Library user** register normally and receive only Lend / Return permissions.
- People selecting **Administrator** enter the **private administrator registration code**. Once they have authenticated and confirmed their email, the database verifies the code and promotes only their own account automatically. It does not use Resend, a verified sending domain, or Vercel email variables.
- The role chosen in the browser is NOT trusted for authorization. Admin access is granted only when the Supabase function verifies the secret code, an authenticated user, and a confirmed email address. Existing administrator accounts retain their access when they sign in without a code.
- Admin navigation: Dashboard, Inventory, Scanned Books, Notifications, Loan History and Import Shelf. User navigation: Lend, Return only. Account settings are tucked into a collapsed section.

## Installation — one-time database upgrade (required)

1. Open your existing Supabase project, **SQL Editor**.
2. Confirm that `public.library_member_roles` exists and that you already have at least one Admin account. Your previous role installation is a prerequisite; do not reinstall the whole roles migration.
3. **Back up your database** and then paste/run the whole `library_admin_access_code_upgrade.sql` file in the SQL Editor. It creates private access-code configuration, failure-attempt history and two role-protected database functions. It does not replace your Inventory, Loans or Review policies.
4. Run the following *read-only* verification query:

```sql
SELECT
  to_regclass('private.library_admin_access_config') AS config_table,
  to_regprocedure('public.library_rotate_admin_access_code()') AS rotate_code,
  to_regprocedure('public.library_claim_admin_access_code(text)') AS claim_code;
```

The three columns should return names, not `NULL`.

5. Deploy the updated project files to Vercel (the updated frontend and the new SQL are separate: uploading the ZIP does not execute SQL).
6. Sign in using an **existing Admin** account. Open **Account & access settings → Administrator registration code → Generate / rotate admin code**.
7. Copy the 64-character code immediately; the database stores only its hash, so the same code will not be shown again. Share it privately with trusted new administrators, not publicly on the website.

## New account registration

**Library user:** Create Account → Library user → enter email and password → confirm email if required → Sign In. Only Lend and Return are available.

**Administrator:** Create Account → Administrator → enter the private code, email, password → confirm email if required → Sign In. The app validates the saved code with Supabase, then opens the admin workspace automatically. If email confirmation happened on a different device and the pending code was lost, sign in normally and use **Account & access → Activate administrator access**.

**Existing library user promoted to Admin:** Sign in normally, then open **Account & access → Activate administrator access** and enter the code. Email confirmation remains required.

**Existing Admin:** Sign in normally; the account's database role is authoritative. Selecting User on the form does not demote an existing Admin.

## Security and limits

- Nobody can become Admin solely by changing a dropdown, editing user metadata, or modifying the frontend. The database function checks the code and authenticated user.
- Five invalid code attempts per account per hour are permitted. To limit broader credential abuse, keep Supabase email confirmation and other Auth anti-abuse protections enabled.
- The code is reusable until an existing Admin rotates it. Rotating immediately invalidates the previous code. Treat it like a privileged credential.
- A pending code is saved to the current browser's session storage to bridge email confirmation. It is deleted after successful activation or a failed attempt and expires after 24 hours.
- Existing email invitation links can still be redeemed if your earlier Supabase invitation functions were installed, but sending new invitations through Resend is no longer part of this streamlined interface.
- Never publish the admin code in the repository, documentation, `.env` file, website source or screenshots.

## Tests performed

- 117 automated JavaScript regression tests passed (including five new access-code/navigation tests).
- Inline JavaScript syntax checked with Node.js.
- Static Chromium layout review for 390px, 768px, 1440px, no horizontal overflow; did **not** test live Supabase authentication.
- The SQL upgrade was reviewed but **not executed on your live database**.

## If a new account is not promoted

Check that the one-time SQL upgrade succeeded, that the private code is current, that their email is verified, and that they have not exhausted the attempt limit. Existing Admins can rotate the code from the Admin interface. If SQL Editor reports an error, save the complete error before making further database changes.
