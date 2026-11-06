# Library Manager — Integrated Header Image Fade

Update date: 6 November 2026

## Change
The Overview and Inventory hero cards use the existing local library photographs under a continuous, feathered navy gradient. The copy region no longer looks like a separate box over the picture. Text, controls, and links remain at full opacity; the treatment darkens automatically at smaller sizes so content stays legible. The Inventory card now uses its own shelf photo on mobile rather than the Overview's reading-room photo.

## Apply
For an existing current build, replace only `assets/library-ui.css` with the file in the upgrade-only ZIP. For a fresh deployment, extract the complete ZIP to the repository root and deploy normally.

## Scope
Presentation/CSS only; no JavaScript, Supabase schema, authentication, data, scan, OCR, AI, syncing, or borrowing logic changed. No new secrets or database migration required.
