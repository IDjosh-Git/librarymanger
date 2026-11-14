# Library Manager v5.63 — Consolidated automation centre (incremental)

## Delivered
- Administrator-only Automation centre from the shared Review toolbar.
- Live server-side Review reconciliation metrics (migration 16, already applied to the connected Supabase project).
- Inventory data-quality report: missing title/author/shelf/physical copy ID, and duplicate physical copy IDs. Same ISBN is **not** a duplicate by itself.
- On-demand lending follow-up CSV for overdue and due-within-three-days loans. No automatic emails or SMS are sent.
- On-demand management summary CSV with loaded inventory, loan and live Review metrics.
- Mobile-responsive dialog, consistent inherited application theme, accessible labels and close controls.

## Deployment
1. Use the v5.63 package, which includes all previous migrations and application assets.
2. Confirm migrations 13–16 are applied; 15 and 16 were applied to connected Supabase project.
3. Deploy on Vercel and verify the centre as an administrator with a fresh session.
4. Validate with real admin/member accounts and compare report totals against database counts.

## Not yet implemented
Enforced edit locks, automatic inventory repair, outbound reminders, reservation lifecycle, personalized recommendations, background scheduling, automated backups and health alerts. These require additional backend services, security policies, service-provider configuration and end-to-end verification. Do not represent this release as implementing them.

## Limitations
Inventory and lending exports use the records loaded in the browser, not a complete server-side audit. No destructive data changes. This package has not been deployed to Vercel.
