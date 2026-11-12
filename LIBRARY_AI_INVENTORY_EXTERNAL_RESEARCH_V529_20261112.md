# Library Manager v5.29 — Verified inventory books + external book research

## Root cause

Prior Floating AI chat accepted an optional book object from the browser as *unverified context*, without re-reading the real `library_books` record. Models could consequently give inaccurate book details or conflate different titles. It also did not automatically look up verified public book information beyond the app; its optional broad search depended on a configured AI provider and toggle.

## Fix

1. **Authenticated live inventory lookup.** `api/book-chat.js` calls new `lib/library-ai-inventory.cjs` for book-specific questions. The lookup uses the already-authenticated library member JWT, the pre-existing `library_books` table and its SELECT RLS. A selected inventory book's `record_id` is passed by the interface and re-checked server-side; a named title or ISBN in the question overrides old selected context. If multiple editions or matching titles remain, the assistant asks for a specific book rather than guessing. If nothing matches, it states that the title could not be verified in inventory.
2. **Only appropriate fields enter AI context.** The SELECT projection is `record_id,book_id,title,authors,barcode,publisher,publication_year,language,pages,subject,shelf_location,book_status`. It NEVER selects borrower names, loans, due dates, user IDs or account data. The response shows the actual available/on-loan copy counts and shelves from live records; the model cannot overwrite these answers. The server responds correctly to straightforward inventory questions even with **no generative AI key**.
3. **Automatic external book metadata.** For verified inventory titles, the server also checks Google Books and (for valid ISBNs) Open Library. A result is used only if ISBN and title agree, or (for books without an ISBN) the title and author match. Verified external descriptions/topics are identified as *catalogue information*, not as pages the model has read; source links appear in the chat. Missing or unreachable external catalogues do not make up details or interrupt inventory answers. Results are cached briefly per runtime to reduce requests.
4. **Optional broader Internet research.** The existing **Search the web** toggle continues to request Gemini Google Search grounding if a compatible Gemini key/model is configured. Phrases such as “search the internet about ...” or “online reviews” also request broad search. Provider fallback is preserved. If a compatible provider is missing, the assistant still reports verified inventory + external book metadata while accurately noting broad search may be unavailable.
5. **Context and UI integration.** Inventory cards' **Ask about this book** action and the Floating AI book selector now send `recordId`. The backend verifies it rather than trusting browser details. The chat displays sources and distinguishes **Live inventory** from **Inventory + verified external catalogues**. Named-book questions also work without selecting a book. Previous weekly-book chat behaviour is preserved, with improved follow-up disambiguation.
6. **Privacy:** no database schema changes, no service-role key exposed, no private borrowing records in prompts. AI chat messages are still stored per-member in Supabase and remain subject to current RLS. The only new data reads are authorized bibliographic/copy-status fields and public external catalogue APIs.

## Install

Deploy the ZIP **root files**, not the parent directory, to the existing Vercel `librarymanger` project, preserving `index.html`, `book-of-the-week.html`, `api/`, `lib/`, `assets/` and `database/`. **Both** the updated `api/book-chat.js` and new `lib/library-ai-inventory.cjs` and `lib/library-ai-research.cjs` are required. Keep existing Supabase and AI provider environment variables. The `GOOGLE_BOOKS_API_KEY` is optional; Google Books public lookups may be rate-limited without a key. To use Gemini broad web grounding, configure a valid `GEMINI_API_KEY` (and optionally `GEMINI_CHAT_MODEL`).

The connected Supabase project already has `library_books`, `library_member_roles`, RLS, and AI chat tables. **No mandatory schema migration** is needed. The optional `database/09_library_ai_inventory_knowledge_update.sql` updates older written knowledge articles to describe the new features; apply it **after** the code is deployed to avoid prematurely describing unavailable behaviour.

Cache-busted `assets/book-guide.js?v=5.29.0` in `index.html` and `book-of-the-week.html` ensures the new record-ID integration is loaded. Hard refresh after deployment.

## Suggested smoke test, signed in

- From **Inventory**, click **Ask about this book** on a known title, then ask **“What is this book about?”**. Confirm its title, author, shelf, ISBN, and copy counts against the Inventory page; verified Google Books/Open Library source links should appear if the book has a matching entry.
- Without selecting a title, ask **“Who wrote [exact inventory title]?”** or **“Tell me about [exact inventory title]”**. Confirm it resolves the same library record.
- Ask about two similar titles without a unique identifier; the AI should offer choices rather than guessing.
- Ask for a nonexistent inventory title; the answer should report no verified match instead of fabricating a book.
- Turn on **Search the web** and ask for broader context or reviews on a verified book; if Gemini grounding is configured and available, the response should include external search references. If unavailable, the assistant should not pretend web research succeeded.
- Re-open the panel and confirm cloud chat remains saved. Check **Book of the Week** to verify the v5.28 live spotlight still works.

## Verification and limits

- Supabase project `hotysnqorkqbiconjskl` was inspected read-only on 12 Nov 2026: `library_books` had **731 physical-copy rows** and RLS enabled with a SELECT policy for authenticated users. This was a schema/policy check, **not** a live signed-in end-to-end chat test.
- `npm test`: **41 passing** unit/integration-mock tests, including inventory record verification, copy counts, conflicting browser context, no match, ambiguous titles, ISBN/title/author validation, external citations, Gemini web-search selection, cloud persistence, weekly spotlight and privacy.
- The updated code was **not yet deployed to production**. Real browser-to-Supabase-to-external-catalogue behaviour must be smoke-tested after deployment. External APIs may omit descriptions, be rate-limited or be temporarily unreachable. AI-generated interpretation should still be considered supplementary and source-dependent; a book metadata API cannot guarantee accurate chapter-by-chapter analysis of an unread book.
