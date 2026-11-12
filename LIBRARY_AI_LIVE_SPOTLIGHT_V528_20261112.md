# Library Manager v5.28 — Library AI connected to the live weekly spotlight

## Problem resolved

Previously, when a member asked “What is the Book of the Week?”, Library AI retrieved a generic help article but not the actual published weekly feature. This sometimes led the model to say that it could not check real-time information and redirect the member to the Book of the Week page.

## v5.28 implementation

- `POST /api/book-chat` now retrieves the **published Book of the Week directly from the same public-safe Supabase RPC used by the featured-book page**, `library_public_weekly_spotlight_v2()`.
- The result is fetched for each relevant question. The response respects manual editorial overrides, the AI weekly pick, and the existing catalogue fallback. No title or week is hardcoded.
- Direct fact questions — e.g., title, author, week, ISBN, shelf, selection reason, subject, availability — receive **deterministic responses from the published record**, even if there is no AI provider key or an AI provider is down. Such responses no longer depend on the model guessing whether it has data.
- Follow-up questions such as “Who wrote it?” can resolve to the Book of the Week from the member’s existing private Supabase chat history, unless a different book has been explicitly selected.
- Open-ended requests requiring generation get the current published book details in the system context and continue through the configured model provider, with a published-record fallback if providers fail.
- The assistant’s system context now includes a verified Library Manager capabilities overview plus the 6 most relevant curated app-help articles from the existing Supabase `library_manager_ai_knowledge` table. This is **retrieval-augmented context**, not fine-tuning the underlying AI model.
- The floating Library AI now includes **This week’s book** as a quick question and labels verified answers as **Live library spotlight**.
- When there is no published book, the response says so. If Supabase cannot be reached, the assistant says it cannot verify the current selection; it does not invent a title.

## Security and compatibility

- Book of the Week data comes exclusively from the pre-existing **public-safe RPC**; no private `library_books`, loan, member, or borrower rows are queried for chat.
- The existing Supabase authentication, library-role check, cloud chat persistence, rate limits, user-scoped RLS, and reset behavior remain unchanged.
- No database schema change, new environment variable, or new secret is required **if** the v5.19 weekly spotlight RPC and v5.25 cloud-chat tables are already present.
- If the newer weekly RPC is absent, the server attempts the existing `library_public_featured_book()` public-safe fallback. General app guidance and other features continue to work unchanged.

## Live read-only verification before release

On 12 November 2026, the connected Supabase project `hotysnqorkqbiconjskl` returned the following published record through `library_public_weekly_spotlight_v2()`:

- Title: **Immigrant, Inc.**
- Authors: **Richard T. Herman; Robert L. Smith**
- ISBN: `9780470455715`
- Week starting: **2026-11-09**
- Selection: **automatic**

This is a dated verification of the live function, **not** a hardcoded title in the app.

## Testing

`npm test` completes **25 passing tests**: live spotlight, dynamic changes, follow-up questions, no selection, RPC failure, grounded complex-query provider context, original cloud persistence, role isolation, visit log, and UI checks. All app/API JavaScript passes Node syntax validation.

## Deployment

Deploy the **root contents** of the v5.28 ZIP to the same Vercel **`librarymanger`** project, preserving the `api/`, `lib/`, `assets/`, `database/`, and `.html` files. This update requires deploying both `api/book-chat.js` and the new `lib/library-ai-context.cjs`; updating only the frontend will not fix the issue. Keep current Supabase and AI-provider environment variables. The existing v5.19 Supabase RPC has already been verified live, so no new migration is necessary.

After deployment, sign into Library Manager, open the floating Library AI, and ask:

1. “What is the current Book of the Week?” — should return the currently published title, authors and details.
2. “Who wrote it?” — should identify the authors of the weekly feature.
3. “Why was it selected?” — should show only the actual published selection reason.
4. “Is it available to borrow?” — should explain that the weekly record does not establish current borrowing availability.
5. “How do I scan, review and save a book?” — should give app-specific guidance from verified Supabase knowledge.

A new featured-book publication should appear in subsequent replies without code edits or model retraining. Live Vercel deployment and an end-to-end signed-in browser test were **not** performed as part of preparing this release.
