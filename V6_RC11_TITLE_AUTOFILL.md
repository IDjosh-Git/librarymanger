# RC11 — Title-first Auto-Fill in Review

When a Review record has a typed title of at least three characters and no valid ISBN, clicking **Auto-fill details** searches the existing `/api/title-search` catalogue endpoint and displays candidate works. The administrator must select the correct result. Only blank bibliographic fields are filled; ISBN and physical-copy identifiers are never inferred or overwritten. When no catalogue match is available, manual completion remains possible.

Existing ISBN/image recognition remains in place for other cases. Title suggestions are not independent evidence for strict automatic approval. No Supabase migration is needed for this change.

Deployment: upload the package to the correct Vercel project, then test title search and selection against a live catalogue. This build has not been deployed or verified against live catalogue providers.
