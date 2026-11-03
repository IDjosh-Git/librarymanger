# Library Manager — Mirror Removal & Interface Refresh

Date: 3 November 2026

## Functional changes

1. Removed the optional Google Sheets mirror panel, connector URL/token fields, connection ping, manual sync button, and hidden form-post target.
2. Removed the Apps Script `Code.gs` connector. No `script.google.com` callbacks, iframe posts, or mirror code remain in the live frontend.
3. Removed mirror submissions from inventory creation/editing, automatic enrichment, lending, returns, deletion, saved scanned-book batches, and shelf-location edits.
4. Removed Google Sheets synchronization language from user feedback and the footer. Old browser-stored mirror connection settings are cleared on startup. This is **local browser cleanup**, not a change to Supabase or an existing Google spreadsheet.
5. Preserved **Google Books** as an optional *catalog metadata lookup*. Google Books is not a Google Sheets mirror and remains part of book search.

## Appearance and interaction

- Replaced over-bright card gradients with a consistent navy/teal system and calmer surfaces.
- Strengthened readability of words on photograph-backed dashboard and inventory hero cards.
- Standardized the alignment of dashboard figures, captions, labels, quick actions, nav links and data panels.
- Fixed the accordion text rotation bug by removing broad `summary span` transforms.
- Replaced text-like `⌄` and `+` disclosure glyphs with standalone CSS chevrons; native `<select>` elements have consistent theme-aware chevron icons.
- Checked light and dark designs at 390 px, 768 px and 1440 px without document-width overflow in the isolated browser fixture.

## Preserved

Supabase authentication, Admin/User roles and database policies, private admin registration code, inventory data, book scanning, Google Books metadata lookup, Gemini AI endpoint, local OCR, Excel import/export, lending, returns, review queue, notification system, and existing Vercel API files.

## Verification and limitations

- Inline JavaScript syntax and Vercel config validated.
- HTML duplicate-ID and required-reference checks validated.
- Static Chromium layout checks confirmed upright dropdown headings, visible chevrons and no horizontal page overflow across sampled screens/themes.
- Full-page browser navigation using live scripts was blocked by the execution environment; only isolated rendering was validated.
- No changes applied to the production website, Supabase instance, permissions, or hosted Google spreadsheet. Real account and database tests must be performed after deployment.
