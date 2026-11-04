# Library Manager — Premium Inventory, Shelf Studio and Book Guide (V3)

**Release date:** 4 November 2026  
**Deployment:** Source package only. Production unchanged.

## Main changes

1. **Inventory-only workspace:** inventory retains the collection KPIs, search, filters, copy management, export, quality tools, and the inventory register. Quick addition, photo scanning, folder/ZIP uploads, bulk OCR, review-queue management and review Excel correction have moved to a dedicated workspace.
2. **Dedicated Shelf Scan & Review page:** Open using the sidebar, mobile menu, mobile bottom dock, Inventory's "Open Shelf Scan & Review" action, or `index.html#shelfScan` after authentication. Separate capture, verification and publication stages; one flat scanner workspace with a new photographic hero. The route is an **independent SPA view**, not a new standalone HTML document. Roles and existing Supabase save flows are preserved.
3. **Book of the Week administration** is an independent administrative page in the same SPA (`#featuredAdmin`). The public editorial page stays at `book-of-the-week.html`.
4. **Book Guide chat:** Floating assistant on Inventory and Lending, plus public Book of the Week. Includes title selection, metadata-based instant answers, suggested questions, and optional multi-turn Gemini 2.5 Flash-Lite. Catalogue answers remain available without a paid account or API key; these are *not* generative model responses. Generative conversations require a configured Gemini API key and provider-available quota. The assistant states when it is using the catalogue fallback.
5. **Responsive UI and themes:** Maintained CSS gets dedicated new layout tokens, cleaner icon/navigation states, an admin mobile dock that fits on one row, consistent modal styling on the public editorial page, light/dark appearances, and reduced-motion support.

## OCR optimizations

- Native barcode detection is attempted first, with title/ISBN lookup before expensive image OCR.
- Tesseract.js is loaded lazily, preloaded when scan images are selected, and workers are reused instead of recreated for each photo.
- Images are resized to a maximum 1,280px dimension before OCR where supported; 90-degree OCR is skipped when pass one is sufficient.
- A bounded two-lane batch queue runs on capable devices; lower-end devices run one lane to prevent memory pressure.
- Batch progress is updated without unnecessary full rerenders of the entire scanned-record list.

**Limits:** No measured end-to-end scan-speed benchmark was performed. Tesseract's first online initialization, device quality, photograph resolution, and network catalogue lookups can still dominate latency. Verify ISBN/covers before saving.

## Book Guide setup

- The API endpoint is `api/book-chat.js` and the server reads `GEMINI_API_KEY` from its environment, never from browser JavaScript.
- Optional `GEMINI_CHAT_MODEL` defaults to `gemini-2.5-flash-lite`.
- On Vercel add the key under the project Environment Variables, then redeploy a **preview**. Do not paste credentials into source files.
- If the Gemini key is absent, rate limited, or the provider is unavailable, the application automatically answers from catalogue metadata. No account is required for this fallback.
- The generative endpoint uses a short server-side request timeout, basic rate limiting, and accepts only bibliographic fields; borrowers' names or circulation records are not sent.
- Avoid assuming the free tier always exists or has unbounded use; eligibility and quotas change by provider/account/region.

## Checks performed

- 46 local Python regression tests passed, including V3 shelf and AI UI assertions.
- `node --check` passed for the new API, Book Guide JavaScript, and main inline JavaScript.
- Parsed maintained CSS files without errors using `tinycss2`.
- API endpoint local smoke tests: HTTP 405 for non-POST, HTTP 503 without configured key.
- Chromium render/screenshot checks with local HTML and CSS at 320px, 390px and 1440px for authenticated SPA panels, and at 390px and 1440px for public Book of the Week. Light/dark states were inspected; no document-level horizontal overflow in tested states.
- **Caveat:** Local browser navigation to the test server was blocked in this environment. The browser visual checks rendered actual HTML/CSS with injected sample catalogue content and did not exercise real Supabase sessions, actual camera/OCR workloads, production Gemini calls or persisted saves. Verify those on a Vercel preview before production deployment.

## Deployment

1. Unzip so `index.html`, `book-of-the-week.html`, `vercel.json`, `package.json`, `assets/`, and `api/` are at the Vercel project root.
2. Deploy to a nonproduction Vercel preview with its existing Supabase configuration intact.
3. Test a real admin account: Inventory -> Shelf Scan & Review -> upload a small photo batch -> review -> save -> confirm catalogue record.
4. Test a regular lender: Lending -> select book -> Book Guide; test the public Book of the Week page and optional Gemini replies.
5. Only then release to production. No source package in this archive contains secret environment variables.
