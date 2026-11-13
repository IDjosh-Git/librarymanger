# Library Manager v5.43 — Signup Confirmation & Delivery Audit

## Diagnosis (13 Nov 2026)

The production Library Manager frontend uses `supabase.auth.signUp` and `supabase.auth.resend`. Supabase Auth—not Vercel's `RESEND_API_KEY` environment variable—sends the confirmation email. A Vercel Resend integration for other app messages does not automatically configure Supabase Auth SMTP.

Supabase Auth logs showed `user_repeated_signup` on 13 Nov 2026 at **10:38:43 UTC** and **10:40:27 UTC**. Both events referred to the same existing account. Checking that account's status without exposing its email showed it was **already email-confirmed**. These attempts did not create a new user and a fresh signup confirmation should not be expected. The intended action is **Sign In**, or **Forgot password** if the existing account holder cannot log in.

The project had **no new `auth.users` registrations in the previous 48 hours** when checked. This does not prove every signup attempt succeeded or that SMTP is correctly configured; it only establishes the observed database state.

## Frontend changes

- Signup feedback no longer implies a new confirmation is necessarily being delivered after a repeated signup.
- Clear guidance to Sign In / Forgot Password for existing accounts.
- The confirmation resend control appears in Create Account mode and after `email_not_confirmed` sign-in errors.
- Suppresses concurrent resend clicks and adds a 60-second local cooldown after an accepted resend request.
- Explains `email_address_not_authorized`, `email_not_confirmed`, and email rate-limit errors in plain language.
- Success messages identify email requests as **requests** rather than proof of inbox delivery.
- No bypass of email verification, no new public email API, and no exposure of service keys.

## Required production configuration for genuinely new users

**Project:** Supabase `hotysnqorkqbiconjskl` (DataLearning, used by Library Manager).

1. In Supabase Dashboard, open Authentication > SMTP Settings (Custom SMTP).
2. Configure and verify a sender domain with an email provider such as Resend. With Resend SMTP, use `smtp.resend.com`, port `465`, username `resend`, and the Resend API key as the SMTP password (enter it in the Supabase Dashboard, never in frontend source or chat).
3. Set a verified `From` email and a sender name, e.g. Library Manager. Keep **Confirm Email** enabled.
4. In Authentication > URL Configuration, set the correct site URL and whitelist the live Vercel URL as a redirect URL.
5. Review Authentication > Rate Limits. Supabase's default hosted sending service is for testing; it restricts recipients to project team members and has a low email quota.
6. Test registration with an **owned, new** inbox, verify that a confirmation arrives, open the link, and sign in. Also test resend (pending account) and Forgot Password. Inspect Supabase Auth logs and your provider's delivery/bounce logs if a message is not received.
7. **Do not** disable email confirmations to work around delivery failures, and do not manually mark unknown accounts as confirmed.

Official documentation:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/testing-auth-flows
- https://supabase.com/partners/resend

## Tests

`npm test` and JS syntax validation for the full inline client script. Production SMTP credentials and an owned new-user mailbox were not available for a real delivery test. No live user accounts or database settings were changed.
