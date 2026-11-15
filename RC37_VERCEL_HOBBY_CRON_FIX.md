# RC37 — Vercel Hobby build fix

The recognition-worker every-minute cron (`* * * * *`) is not allowed on Vercel Hobby. The schedule has been removed from `vercel.json`. Recognition processing is now invoked from the existing `operations-cron` daily execution after notifications, retaining two cron definitions.

**Trade-off:** this avoids the deployment validation failure, but a recognition job may wait until the next daily operations run (07:00 UTC), and only one recognition job is processed per daily run. This is a build-unblocking fallback, **not** real-time AI recognition. A frequent external scheduler or Vercel Pro cron with appropriate job processing is needed for timely queue throughput.

Set `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and provider credentials in Vercel. The existing weekly and operations schedules are preserved.
