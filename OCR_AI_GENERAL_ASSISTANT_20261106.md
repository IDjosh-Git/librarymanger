# Library Manager: OCR & AI Controls + General Assistant

Release: 6 November 2026

## Scan & Review
- **AI Cover Recognition** and **Local OCR** are now visible switches directly below Folder/ZIP/Photo uploads (not hidden in Advanced Settings). Both start enabled.
- Turn off AI to avoid uploading cover images to the AI provider. Local OCR processes images on the device with Tesseract.
- Scanner behavior, selection, deduplication, title-only review, auto-save, and Supabase record storage are unchanged.

## Library AI
- Click the floating **Ask Library AI** button from any page.
- Ask a question with **no book selected** to use Gemini as a general AI assistant; select **Library book context** if you want to discuss a specific catalogue title. The public catalogue only supplies bibliographic fields, not borrower records.
- Turn on **Search the web** when current information or external references are needed. This requests Gemini Google Search grounding and displays returned sources. Search is off by default to avoid unexpected quotas or charges.
- If the selected Gemini model/tier does not permit grounding, the server retries an ordinary AI answer and labels it as not web-verified. Do not treat an ungrounded answer as fresh research.
- The provider key stays in the Vercel server environment. Required: `GEMINI_API_KEY`. Optional: `GEMINI_CHAT_MODEL` (default `gemini-2.5-flash-lite`). For image scanning, `GEMINI_MODEL` remains separate.
- Google Search grounding is subject to provider quotas and potential billing, depending on the AI plan and model. Review https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/gemini-api/docs/generate-content/google-search before enabling it for a busy public site.
- In-memory rate controls limit typical per-IP usage, but distributed usage controls and bot protection are recommended before a high-traffic public launch.

## Modified website files
`index.html`, `assets/library-ui.css`, `assets/book-guide.js`, `assets/book-guide.css`, `api/book-chat.js`, `vercel.json`.

## Deployment
Replace these six files in your Library Manager GitHub repo, keeping the relative paths. Commit to the main branch and let Vercel redeploy. No Supabase table or RLS changes are required. Existing AI configuration is reused.

## Testing
- 72 Python regression tests passed.
- All 6 existing JavaScript suites plus a new general-AI/scan-toggle suite passed with simulated API responses.
- Browser test: toggles visible/clickable; chat sends without book, opted-in web search and sources render safely; 320, 390, 768 and 1440px checks pass without document horizontal overflow.
- Existing book-guide mobile scroll locking and scanner browser checks passed.
- No live provider calls or real cover recognitions were made during tests. A real Vercel production smoke test is still required.
