# RC32 — Durable server-side recognition

## Implemented
- Signed-in users enqueue two or three resized JPEG photographs through `/api/recognition-jobs`.
- Raw photographs are stored in a private Supabase Storage bucket; job metadata and evidence are stored in an owner-scoped history table.
- Vercel Cron calls `/api/recognition-worker` every minute. A database function atomically claims a queued job and recovers abandoned running jobs after four minutes, up to three attempts.
- The worker calls configured AI vision providers, fuses photo evidence, verifies ISBN/title/author/year against Open Library, and stores suggestions only. Inventory is never automatically approved.
- The Review UI polls jobs, allows cancellation, displays history, and requires confirmation before applying suggestions to blank fields. Jobs continue when the browser closes, assuming cron runs.
- Private photographs are deleted after successful processing; failed photos remain available for retry and are removed by the cleanup worker after 24 hours. Cancellation removes the images immediately.

## Required Vercel environment variables
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, Supabase service role secret. Never use a `NEXT_PUBLIC_` prefix.
- `CRON_SECRET` — random long secret; Vercel automatically attaches it to cron requests.
- One or more of `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY` — configured vision provider.
- Optional `SUPABASE_URL` (defaults to the existing configured project).

## Important deployment limits
- **A Vercel plan supporting every-minute cron and 60-second function duration is required.** If the plan does not support these limits, deploy the worker to a compatible scheduled runtime or change the schedule.
- Vercel request payload limits still apply. Two or three JPEGs must be resized/compressed before upload, and the combined JSON payload must fit your deployment's request-body limit.
- The existing application is a static HTML SPA; the new API uses Vercel serverless Node functions.
- Do not expose the Supabase service role key to the browser. Keep the Storage bucket private.
- The Supabase migration for the queue, private bucket, RLS and atomic claim was applied to project `hotysnqorkqbiconjskl`.

## Verification performed
- 264 automated Node tests passed, including new queue input, cron authorization, UI wiring and Vercel config tests.
- Supabase schema, private bucket and grants inspected. Authenticated users have read-only owner-scoped access to job rows; API server controls writes.
- A Chromium headless browser launch was attempted, but timed out; it is **not** an authenticated browser E2E pass.
- **No live AI provider keys were available in this execution environment.** Live provider success/failure behavior has NOT been tested.
- **No user-supplied real book photographs were available for an accuracy benchmark.** Accuracy has NOT been measured.
- No deployment to Vercel was performed.

## Operational note
This is a substantial durable-job implementation, but production acceptance requires a preview deployment with the real secrets, an authenticated admin session, a sample of representative real book photographs, and confirmation of cron frequency and execution limits.
