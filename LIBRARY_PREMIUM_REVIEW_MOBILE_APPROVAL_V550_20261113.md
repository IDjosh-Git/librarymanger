# Library Manager v5.50 — Premium Review editor & mobile approval

Date: 13 November 2026  
Base: v5.49 full source release. This release does **not** alter production Supabase records or policies.

## Review workflow

1. Open Review. The durable, shared cloud Review queue remains the source for pending items.
2. Edit the book title directly, plus author and **optional** ISBN. Other editable fields are located in **More book details**: shelf/location, publisher, publication year, language, pages, and subject/category.
3. Tap or click **Approve & save** on that card. A valid title is the sole required bibliographic field; an absent ISBN is stored as the empty string because the existing `library_books.barcode` column is `NOT NULL`. This is not a fabricated ISBN.
4. The existing `saveBatch` path inserts one new physical copy per reviewed photo using a stable `record_id`; response reconciliation and unique photo-signature handling are retained. The cloud Review record is resolved after a successful Inventory insert.
5. The card and Review header now report saving, completion, errors, and retries. Unsuccessful saves preserve the edited fields and do not silently disappear. The **Approve all ready books** action remains available.
6. Optional Book API, OCR, AI, cover replacement, delete image, saved-book correction, and spreadsheet import/export tools remain functional; advanced recognition actions are in an expandable area so ordinary approval is straightforward.

## Mobile interaction fix

Old behavior: the Review editor rebuilt its entire card in the field `change` event when an input lost focus. On touchscreen browsers, this could replace the Approve button before the corresponding `click` event fired, causing an apparent no-op. Save errors were also mainly displayed in the Scan progress area.

New behavior: native `<form>` with a `submit` event; edit events synchronise the existing form to the draft **without** rebuilding its DOM. A tap snapshots all current fields before calling the existing Supabase save pipeline. Title-only approval works without ISBN. Form-level alerts show network or database errors, and retry keeps the stable record ID. Touch targets are at least 54px tall at mobile widths.

## Design

- Compact photographic hero, clear queue counts, simplified editor hierarchy, navy/teal call-to-action, clean field labels, responsive cover area, optional advanced details and tools.
- Isolated the Review palette from legacy purple global variables; light and dark mode now match the established navy/teal colour system.
- CSS remains in the project's one consolidated authenticated-app stylesheet (`assets/library-manager-v542.css` with cache version `5.50.0`); no new legacy layer or duplicate stylesheet file.

## Verification

- `npm test`: **171 passing tests**, 0 failures, including six new Review-specific tests.
- Chromium static browser + mock-Supabase interaction tests at **320, 390, 768, 1024, 1440px**; simulated **tap** at 320/390px; no horizontal overflow; Approve button ≥54px mobile and ≥51px desktop.
- Tested empty-title validation, title-only saving, edited author/publisher/shelf being included in the insert, generated Book ID response, simulated network error and successful retry, with no duplicate insert.
- Light/dark screenshots reviewed. Main inline JavaScript syntax validated.

## Deployment and limits

This ZIP is **not deployed** to Vercel. Live end-to-end authenticated saving from real iPhone/Android devices and real Supabase connections requires deployment and an acceptance test; the mocked tests do not independently prove real API availability or perfect reliability. The shared database's ISBN-less records are supported by the schema, but no production book was added during validation.
