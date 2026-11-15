# RC23 AI assistant changes

- Multiple private Supabase conversation threads: migration applied live (drops one-thread-per-user unique constraint, adds title and recent-thread index); thread selector and New button; authenticated per-thread reads/writes/deletion.
- Book reservation handoff: a selected book can open the existing reservation dialog, prefilled by book title; reservation still requires explicit user selection and confirmation.
- Read-only admin insight endpoint: returns sampled pending review and inventory completeness counts, authenticated and role-gated. Sample limit is 1,000; not a full-catalogue aggregate.
- Existing AI provider failover, cloud persistence, catalogue matching, book results, voice dictation retained.

**Still outstanding**: true token streaming from the upstream model (the current provider pipeline returns complete responses); browser-based authenticated E2E testing; live Vercel deployment; broader admin analytics beyond the sample. Do not claim these are implemented.
