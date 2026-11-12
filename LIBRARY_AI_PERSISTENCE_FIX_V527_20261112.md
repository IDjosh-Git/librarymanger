# Library Manager v5.27 — Floating AI & Supabase persistence fix

**Release:** 12 November 2026  
**Base:** LibraryManager_v5.26_Premium_Daily_Usage_Register_20261112.zip  
**Deployment target:** Existing Vercel project `librarymanger`  
**Supabase project:** Existing `DataLearning` project (no migration needed)

## Confirmed cause

Supabase Cloud API logs on 12 November 2026 show POST `/rest/v1/library_manager_ai_messages` returning HTTP **400**, with proxy status **`PostgREST; error=PGRST102`**. The previous `insertMessages()` sent a bulk JSON array where the user's message had 4 fields and the assistant's message had 6. PostgREST rejects arrays whose records have different keys. Previously, the server obscured the useful PostgREST error and surfaced the generic chat-saving failure.

## Changes

1. The backend now uses `insertUserMessage()` and `insertAssistantMessage()`, each a single-row insert with the same complete record structure (`conversation_id`, `user_id`, `role`, `content`, `mode`, `sources`). Each row is verified as saved before progressing. User messages are saved before provider generation; user content remains available if an AI provider temporarily fails.
2. `GET /api/library-ai-history` automatically creates or reuses the user's cloud conversation. Its reset endpoint keeps the existing account-scoped deletion behavior.
3. The floating AI panel now has a small title-adjacent connectivity dot only: **green** after a successful Supabase request, **grey** while loading or when disconnected, signed out, or offline. There is no visible status sentence or “Not saved” banner.
4. HTTP error messages and codes are logged on the server for diagnosis; end users see short guidance instead of misleading connection/sync success claims.
5. Both app pages that embed Library AI now reference cache-busted v5.27 JavaScript/CSS assets.

## Verification

- All **18 Node.js automated tests** pass (`npm test`). The tests emulate PostgREST's `PGRST102` for heterogeneous bulk requests and verify that the revised implementation uses safe individual inserts.
- Real Supabase schema, RLS policies, grants, and logged errors were inspected.
- A production-database **smoke test** ran two `INSERT`s under an authenticated member role inside a transaction, followed by `ROLLBACK`; both succeeded and **zero messages** were left in the production table afterward.
- All modified JavaScript files passed `node --check`.
- No service-role key is present in the browser, and private chat history is not copied to local or session storage.

## Publish and acceptance checklist

1. Deploy this ZIP's contents to the **existing** Vercel Library Manager project. Do not create a second Supabase project or rerun the historical database migrations.
2. Hard-refresh the app. Sign in with an active Library Manager account and open the floating Library AI; check the dot turns green on successful history load.
3. Ask “How do I scan and review a book?” and wait for the AI reply; check that both messages remain after a page reload and another sign-in/device.
4. Temporarily disconnect the network and verify that the dot changes to grey without any red/warning text banner. Reconnect and reopen the chat.
5. Use **Reset** and confirm only the signed-in account's Library AI conversation is cleared, with library books, loans and daily attendance untouched.

**Live deployment was not performed in preparing this ZIP.** The previous live build will continue showing the error until the repaired assets and API route are deployed.
