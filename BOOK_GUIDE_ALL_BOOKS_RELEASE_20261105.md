# Library Manager — Full Book Guide Catalogue & Everywhere Access

## What's changed
- Book Guide now loads all catalogue titles on the **Book of the Week public page** and for visitors on the public sign-in/home screen, rather than loading only the featured title.
- On authenticated pages, the guide continues to use the shared live inventory loaded for that session. The book selector is updated whenever the inventory reloads.
- The floating assistant is available on **all workspace sections**, including Overview, Inventory, Shelf Scan, Scanned Books, Lending, Returns, Notifications, History, Book of the Week management, Contact Settings and Administrators. It also appears on the public home and public Book of the Week pages.
- Added a searchable book picker and a live matching-title counter. Distinct editions remain distinct while repeated physical copies are deduplicated in the selector.
- The currently featured book remains accessible if it is not in the ordinary catalogue results.
- Previous Book Guide chat formatting, fallback answers, Gemini integration (when configured), and responsive visual design are preserved.

## Database
`library_public_book_guide_catalog.sql` provides a **read-only public RPC** for bibliographic data only. It excludes borrowers, loans, account information, internal record IDs, circulation statuses, and administrative permissions.

The migration was **applied and verified** on the connected Library Manager Supabase project (`hotysnqorkqbiconjskl`) on 5 November 2026. Running the bundled SQL again is not necessary for this existing project. For a fresh deployment on a different Supabase project, run the SQL file after setting up the original Library Manager schema.

At verification there were 664 physical copies, 589 unique titles by name, and **609 selectable catalogue entries** after preserving editions and author variants. The `anon` role was verified able to read the public RPC.

**Privacy note:** Book title, author, ISBN where valid, shelf, publisher, year, subject and page-count metadata are publicly discoverable. No reader or borrowing records are returned. If the library's inventory itself must not be publicly discoverable, restrict the RPC to authenticated users instead; this would limit the public Book of the Week guide accordingly.

## Verification
- 69 Python automated tests passed (including 4 new Guide contracts).
- Scan integration Node regression tests passed.
- JavaScript syntax checks and inline HTML script syntax checks passed.
- Browser interaction checks at 390px, 768px and 1440px passed: menu includes full mocked catalogue, search filters titles, selecting a title starts a conversation, Escape closes the panel and there is no horizontal overflow.
- Signed-in inventory remains separate from public-catalogue loading.

## Deployment
The database RPC is already installed. Publish the updated source to the **Library Manager** GitHub/Vercel project. Do not upload to the DataLearning project.
