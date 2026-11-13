# Library Manager v5.36 — Reliable ISBN and conflict-safe catalogue lookup

## Root cause

In v5.35, the server normalized some 14/15/18/19-digit Bookland barcodes (GTIN zero padding and 2/5-digit EAN price supplements), while the automatic routing and some browser-side helpers still required exactly 10 or 13 characters. This caused correctly identified books to be sent to Review. Several metadata providers were also queried for each lookup even when two trustworthy exact-ISBN providers had complete bibliographic fields, increasing latency and conflict risk.

## Repairs

- Added `assets/book-identifiers.js`, a shared checksum and canonical ISBN policy used by the browser, server, scanner, inventory display, matching, and automatic Inventory/Review routing.
- Supports ISBN-10 (including check digit X), ISBN-13 (978/979, checksum-verified), EAN-13 with 2/5-digit price supplements, zero-padded GTIN-14, combined zero-padding plus supplements, and scanner symbology prefixes. Retains invalid/nonbook identifiers unmodified for Review and exact-product-barcode lookup; never invents a check digit.
- The scanner normalizes a detected barcode before metadata lookup and auto-routing. Valid extended barcodes now save the canonical ISBN on successful verified catalogue match. Still sends genuinely unverified or mismatched titles to Review.
- Google Books and Open Library Edition are the primary, independently verified ISBN sources, queried in parallel. When essential fields are missing, Open Library Books API, HathiTrust, ISBNdb (when configured), and Open Library Search fill gaps. Specialist Crossref, DataCite, Internet Archive, Library of Congress, and Wikidata remain as last-tier exact-ISBN fallbacks for unidentified/underidentified works.
- Catalogue merges only fill missing fields, never overwrite established fields, and reject incompatible titles. Strong conflicting primary sources now set a `conflicted` flag so auto-routing sends the affected book to Review instead of creating a potentially wrong inventory entry. The direct browser fallback follows the same rule.
- API JSON retains per-provider `checked` diagnostics (`found`, `no_match`, `unavailable`, `conflict`), `sources`, `partial`, and now `conflicted`/`conflicts`, with no upstream secrets returned. Unneeded providers are skipped by design to reduce recognition latency and quota usage.
- Existing automatic Inventory saves, Review fallback, AI/OCR Settings, bulk upload progress, deduplication and security boundaries remain unchanged.

## Tests performed

- `npm test`: **113 passed** (103 existing tests plus 10 new provider/ISBN tests).
- Browser module smoke tests in Chromium at **320, 390, 768 and 1440 pixels**: canonical ISBN, Inventory matching, route to Inventory all pass.
- Mocked-provider coverage includes full primary result with no extra API calls, one primary unavailable, conflicting primary titles, incomplete primary fields triggering complementary APIs, and specialist fallback after no match.
- Syntax checks performed on all edited JavaScript and inline scripts. ZIP integrity validation performed after packaging.

## Known limitations / safe behaviour

- A valid ISBN-13 **alone** does not prove that a particular title/edition has been identified. If no catalogue and no high-confidence inventory match identifies a title, Review remains necessary; this is not an ISBN-length error.
- A non-ISBN barcode, an invalid checksum, or truly conflicting source titles must not automatically create a verified Inventory record.
- Some public APIs may be unavailable or rate-limited in production. ISBNdb requires `ISBNDB_API_KEY` in the deployed environment. The public URLs could not be reached from the test environment; network/credential health in the live Vercel project has **not** been verified. Mock responses and source-level code paths passed, not production end-to-end API calls.
- Real-image accuracy, latency and 90% metadata completeness are not guaranteed by the simulated tests. Verify with representative actual ISBN-13, supplementary-barcode and ISBN-10 photos after deploying.
- The ZIP is a **source release**, not a live deployment. There is no Supabase schema migration. Deploy the root contents to the existing Vercel `librarymanger` project, preserve its environment variables, and hard-refresh.
