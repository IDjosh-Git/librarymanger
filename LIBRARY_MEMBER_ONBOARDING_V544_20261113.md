# Library Manager v5.44 — Library Member by default

## Requirement
Every account registered through Library Manager should start as a regular **Library Member**. Self-registration must not grant administrator access. After confirming their email, users should sign in to access the member workspace.

## Data model
The database's `public.library_member_roles` table stores `role='user'` for Library Members and `role='admin'` for administrators. **Do not rename `user` to `library_member`** without migrating every RLS policy, RPC and app role check. The existing `auth.users` trigger `library_member_signup_role` calls `private.library_assign_user_role()`; it was verified **enabled** and inserts `user` on new signup with `ON CONFLICT DO NOTHING`, preserving existing roles.

## Changes
- Removed public User/Admin choice, admin signup-code field and all associated dead frontend event handlers.
- Create Account clearly states the fixed Library Member role. Signup sends email/password and redirect options only, never a self-asserted privileged role.
- Retained Resend confirmation and password recovery, including non-disclosing email confirmations.
- Admin invitations remain usable: a pending invitation is redeemed only after authentication, through existing server-side validation. Existing members may activate an administrator code in Account settings, subject to server checks.
- Updated signed-in role badges, account text and admin-removal messages.

## Live database check and correction
- Before correction: 3 Library Member accounts, 5 administrators, 1 existing confirmed Auth account with no Library Member role.
- The unassigned account was confirmed to be the actor in the repeat-registration logs from 13 November 2026. It was safely assigned `role='user'` (single row), without overriding other roles.
- After correction: 4 Library Members and 5 administrators. No email addresses or secret tokens are included in this release.
- **No schema migration was applied**. The existing `auth.users` trigger remains enabled; another app sharing the project can also trigger it, as before. This should be reviewed separately if cross-app membership segregation is necessary.

## Verification
- 139 automated Node tests passed; zero failed.
- New tests verify no role selector/admin field remains, signup payload has no role authority, and administrator code promotion still calls the existing server RPC.
- Browser smoke tests confirm the fixed-role card and no horizontal overflow at 320, 390, 768, 1024 and 1440px.
- Main inline application JavaScript passes `node --check`.

## Deployment acceptance check
1. Deploy v5.44 to the existing Vercel project and hard-refresh.
2. Create a new account with a test email you control; verify the Create Account form offers *only Library Member* and no admin choice.
3. Confirm email (if email confirmation is enabled), sign in, and check access to Lending/Returns/My Daily Visit Log; the role badge should say Library Member.
4. Check the role in Supabase (do not publish user emails): `select role from public.library_member_roles where user_id = '<known test uuid>';`.
5. Verify existing administrators still see their admin workspace; a member must not gain admin access without a valid, server-approved invite/code.
6. Repeat on mobile and desktop. The test does not replace a live signup/confirmation email delivery test.

This ZIP has not been deployed; the one existing missing role was repaired in the linked live database.
