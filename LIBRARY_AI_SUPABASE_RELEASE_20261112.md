# Library Manager v5.25 — Supabase AI assistant and private cloud chat

## Source and scope

Updated from **LibraryManager_v5.24_Add_Photo_Preview_Fix_20261107.zip** (latest Library Manager archive visible in the user's Library at the start of this task). This is **Library Manager**, not the Prompt Atelier project. Existing inventory, Scan, Review, lending/returns, Book of the Week, reading guide, OCR, mobile navigation and photo preview code are preserved.

## Implemented

- The floating **Library AI** panel has an explicit **↻ Reset** button with confirmation, accessible label and cloud-sync status indicator.
- All AI conversation history is retrieved and persisted **only in Supabase**, under each authenticated `library_member_roles` account, not localStorage, sessionStorage or browser-provided history. The server verifies the Supabase bearer token by calling `/auth/v1/user` and validates active library membership.
- The reset action calls `DELETE /api/library-ai-history`, deleting the member's conversation. Its message rows are deleted by an actual Postgres `ON DELETE CASCADE` foreign key. Other library members' conversations are not affected. Book inventory, lending and Review data are unaffected.
- `POST /api/book-chat` uses cloud chat history and retrieved, curated **Library Manager app-specific help**. The AI model may be Gemini, OpenRouter or Groq depending on keys configured in Vercel. The code does **not fine-tune a model**; it grounds responses in maintained knowledge from Supabase, and answers certain help questions directly from the curated knowledge if provider services are unavailable.
- Added app-specific quick questions: **App guide**, **Scan workflow**, **Lend & return**. Book context switching no longer erases the conversation. Public pages continue to function, but **AI chat requires an authenticated Library Manager member**.
- The AI service **fails closed** for chat persistence: a failed Supabase write cannot produce a normal saved-chat success response.
- No service-role secret is sent to the browser; server-side cloud operations use the verified member's access token and user-scoped Postgres Row Level Security.

## Supabase migration — already applied

Project: `DataLearning`, ID `hotysnqorkqbiconjskl` (shared with other apps). This update creates only Library Manager-prefixed new tables:

| Table | Purpose |
| --- | --- |
| `public.library_manager_ai_conversations` | One private active chat per signed-in Library Manager member |
| `public.library_manager_ai_messages` | Role, content, optional provider mode/sources, timestamps; cross-user foreign key isolation |
| `public.library_manager_ai_knowledge` | Editable, curated app-support knowledge base |

A separate follow-up migration also adds `message_sequence` so chat message order is deterministic even when a question and answer share the same transaction timestamp.

The full schema and policies are available in `database/06_library_manager_ai_cloud.sql` for restoring or installing in a new Supabase project. A conservative starter seed for fresh installations is `database/07_library_manager_ai_knowledge_seed.sql`.

**30 detailed app-help entries have already been seeded in the connected Supabase project**, covering sign-in and access roles, scanning, OCR, exact duplicate-photo protection, Review, photos, inventory, ISBN and physical copies, lending, returns, overdue notifications, weekly reading, AI options, chat reset, cloud sync and security. Owners can update approved knowledge articles from the Supabase Table Editor.

All three tables have Row Level Security enabled. Signed-out clients cannot read chat or knowledge. Signed-in members can read/write/delete only their own chat. Knowledge base editing is restricted to verified Library Manager administrators. This migration does not modify Library Manager's existing books/loans or other app tables.

## Vercel and application deployment

Deploy the contents of this ZIP to the **existing** Vercel project named `librarymanger`. Retain the complete `assets/`, `api/`, `lib/`, and `database/` folders.

Existing production environment variable names were verified: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY` (plus separate service settings). No new key is necessary for the cloud chat; the app uses the existing Supabase publishable key and user auth session. **Do not put the Supabase service-role key or AI provider keys into client-side JavaScript.**

New endpoints:

- `GET /api/library-ai-history` — load the signed-in member's latest 60 messages
- `DELETE /api/library-ai-history` — permanently reset member's cloud chat
- `POST /api/book-chat` — infer from cloud history + Supabase knowledge and save the question/answer

**No live deployment was performed.** A user account is required to verify actual cross-device persistence on production after the deployment.

## Verification

- `npm test` — **9 tests passed**, including authorization required, app-help retrieval, cloud save/reload, cross-user isolation, Supabase reset, no browser storage fallback, failure on unavailable provider, and fail-closed cloud write.
- All application JS assets, helpers, and API modules passed `node --check`; main page inline JS passed syntax checks.
- A browser in-page test exercised mobile Reset UI, mocked cloud history restoration and confirmed reset changes the view, plus desktop panel rendering. Direct navigation to a localhost preview URL was blocked by the browser's administrator policy, so a full live-site browser test has **not** been claimed.
- Supabase verification: three tables, **30 enabled help articles**, 10 RLS policies, no anonymous SELECT privileges on chat or knowledge. The Supabase security advisors reported no findings associated with the new `library_manager_ai_*` tables (unrelated existing project advisories remain).

## Privacy and limitations

- Saving chat to Supabase does not mean training the AI provider's underlying model. The app provides the approved help text on each relevant request.
- Only conversation messages are cloud-backed. OCR runs locally on the device; existing display preferences may still use browser storage.
- Chat input is limited to 1,200 characters per request. The server currently restores up to 60 messages and sends the most recent 10 messages as model context.
- AI can explain library workflows but cannot check private borrowing records, execute inventory changes, assign roles, or personally verify an individual user's account without separate authorized actions.
