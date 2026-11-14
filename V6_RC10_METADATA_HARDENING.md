# RC10 — Independent metadata verification hardening

- Replaced merged multi-provider bibliographic evidence with direct ISBN-specific Google Books and Open Library edition responses.
- Each provider response must explicitly contain the scanned ISBN and exactly match normalized title and authors.
- Conflicting metadata for the same ISBN blocks verification; provider outages fail closed when no trustworthy match exists.
- Existing verification evidence for each processed queue entry is invalidated before a fresh verification attempt, preventing stale evidence from surviving a failed recheck.
- Administrator-only endpoint retains bearer-token validation and server-side Supabase service-role writes.
- Tests: 243 passing, including exact edition, conflicting provider, and ISBN mismatch cases.

## Important production limits
This package has not been deployed to Vercel and no live provider-to-database request has been verified. Automatic approval remains disabled. Metadata evidence freshness is not yet enforced by the database approval RPC, and stale evidence can remain if the queue is edited after verification. Do not enable unattended auto-approval until this is fixed and staging end-to-end tests pass. No live inventory records were modified.
