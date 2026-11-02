# Library Manager — Sign-in and role selection UI correction

**Changes (2 November 2026)**

- Sign In shows only email/password, sign-in actions and recovery. No User/Admin selection or Choose Workspace block. The authenticated account’s verified Supabase role determines the landing page.
- Create Account offers two visually distinct role choices: **User** or **Admin**. The selected option has a dark navy/teal surface, high-contrast white text, and a visible tick marker. Both choices expose `aria-pressed` to assistive technologies.
- Admin access code entry is displayed only on Create Account when Admin is selected. Existing users can still activate administrator access from Account & Access Settings after signing in.
- When an existing user enters an admin code on Create Account and switches to Sign In, the code is held in session storage for server-side verification after authentication (subject to confirmed email and database function rules).
- Removed the requested explanatory paragraph beneath **Administrator registration code** in the account navigation; the Generate / rotate button remains available.
- The existing wide sidebar, mobile navigation, existing permissions, and SQL migration remain unchanged.

**Deployment:** Replace the project files with the contents of this ZIP and redeploy on Vercel. No additional SQL migration for this UI-only update. Existing Supabase role and admin-access-code upgrades are still prerequisites.

**Validation:** static HTML/role-state checks, inline JavaScript syntax, Vercel configuration, and ZIP integrity passed. Full browser interaction and live Supabase authentication were not verified in this environment. Test one Admin and one User account against your real Supabase project before production use.
