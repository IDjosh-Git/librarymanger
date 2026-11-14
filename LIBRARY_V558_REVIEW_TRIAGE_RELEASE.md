# Library Manager v5.58 — Review triage

Adds a Review queue sorting control: original order, missing titles first, ready to approve first, other administrators first, and possible duplicate ISBNs first. All sorting retains original record indices so edit/approval actions target the correct physical copy. Possible ISBN matches are advisory only: multiple physical copies may legitimately share ISBNs. Existing search and pagination continue to work. No database migration is required beyond earlier releases.

## Deployment
Deploy application files to Vercel after applying prior required Supabase migrations. Test with two administrators and confirm shared Review permissions, cross-account updates, and duplicate warnings. No live deployment or database mutation performed.
