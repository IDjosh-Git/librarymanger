# Library Manager v5.45 — Role verification and original registration restored

## Problem

The Login flow used `.single()` on `public.library_member_roles`, so an existing authenticated user whose row was missing or temporarily invisible to the client received:

> Account permissions could not be verified: Cannot coerce the result to a single JSON object.

Version 5.44 also removed the former User/Admin account-type selector. This release restores the familiar registration flow without allowing public signup inputs to grant privileged access.

## Intended workflow

- **User** (default): register with email and password, no access code. An automatic `auth.users` trigger assigns the database role `user`, displayed as **Library Member**. On sign-in, the role resolver repairs a missing member row if necessary.
- **Admin**: select Admin and enter a private access code issued by an existing authorized administrator. Supabase Auth creates the account as an ordinary member first. After email verification and sign-in, the code is verified by the existing server-side admin invitation/access-code functions. No role is supplied in signup metadata or trusted from client controls.
- **Sign-in**: uses `public.library_resolve_my_role()` to fetch the authenticated person's server-verified role. It always preserves existing admin privileges, and creates a missing role only as `user`. When an already confirmed account signs in, it opens that account's permitted workspace.
- **Errors**: no `.single()` in the role gate. The app provides a clear permissions warning and a Retry button, without exposing raw database errors. An older, unupgraded server uses `.maybeSingle()` for an existing role only; missing roles require the SQL upgrade.

## Cloud role repair (already applied)

The migration in `database/11_library_self_healing_role_resolution.sql` was installed in the linked Supabase project `hotysnqorkqbiconjskl` as `library_self_healing_role_resolution_v545`.

The `public.library_resolve_my_role()` function:

1. Requires a signed-in Supabase user (`auth.uid()`).
2. Creates only that user's missing `library_member_roles` record as `role='user'` with `ON CONFLICT DO NOTHING`.
3. Returns only that user's server-owned role; it cannot read another person's role through an argument.
4. Is executable by `authenticated` only, not `anon`/`PUBLIC`.
5. Does not change an existing Admin role and does not treat user-editable metadata as authorization.

Production checks after migration: 9 known account roles, 5 admins, no missing role assignments. A transaction-scoped authenticated query returned `user` for a member and `admin` for an administrator. No unrelated account records were changed.

## Verification

- 146 Node automated tests passed; 0 failed.
- Updated tests cover free User registration, Admin code requirements, Admin role preservation, role resolution and missing-role fallback.
- Browser role-selector interaction passed at 320, 390, 600, 768, 1024 and 1440 px without horizontal overflow.
- Browser signup/resend layout passed at 320, 390, 768, 1024 and 1440 px.
- Main inline JavaScript syntax check passed.
- Retains existing book scanning, review, inventory, styles, sidebar, OCR/AI settings and Book of the Week features.

## Deployment

The database migration is live already. Deploy this ZIP's source to the existing Vercel `librarymanger` project to activate the corrected sign-in and registration UI. The app has not been deployed by this release operation. An end-to-end real-user sign-in and confirmation-email check should be performed on the deployed site. The previous Supabase SMTP delivery limitation is a separate issue and is not altered by this release.
