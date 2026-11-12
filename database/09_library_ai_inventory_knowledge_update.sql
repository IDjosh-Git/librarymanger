-- Optional text-only knowledge refresh for v5.29.
-- Deploy the v5.29 API/front end BEFORE running this statement.
-- No schema change, permissions change, or private inventory export.
UPDATE public.library_manager_ai_knowledge
SET answer = CASE slug
  WHEN 'ai-assistant' THEN
    'Library AI provides app guidance and private cloud chat for signed-in Library Manager members. For book questions it now verifies the title, authors, ISBN, shelf and copy availability directly from authorized library_books records, without exposing borrower names or loan details. It enriches matched books through Google Books/Open Library and can request broader online research when Search the web is enabled and a compatible AI provider is configured. It does not modify inventory or permissions.'
  WHEN 'inventory' THEN
    'Authorized members can view library inventory with title, author, ISBN, shelf and physical-copy status. From a book card select Ask about this book to bring the specific book to Library AI. The assistant re-checks the chosen record in Supabase rather than assuming browser-provided metadata is correct; questions can also name a title or ISBN directly. Some similar books may require choosing the exact edition.'
  WHEN 'web-research' THEN
    'For a verified inventory book, Library AI automatically checks matching metadata from Google Books and Open Library and displays external source links where available. To request broader Internet information or reviews, enable Chat options > Search the web, which relies on supported AI search grounding. Online sources may be missing or unavailable; never pretend external sources were verified when they were not.'
  ELSE answer
 END
WHERE slug IN ('ai-assistant','inventory','web-research');
