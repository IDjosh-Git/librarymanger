# Library Manager — automatic weekly spotlight and contact editor

## What's included

- Book of the Week uses the administrator's published choice when one exists. If **no manual choice** exists, the public advert calls a limited, public Supabase function to choose a real catalog title automatically. The result is stable for each ISO week (UTC), rotating at the next week when inventory contains eligible books. It does **not** require a scheduled background job or a login.
- Administrators can open **Inventory → Book of the Week** to manually feature a title or select **Use automatic weekly pick** to clear their manual choice. The automatic selection also works when no administrator has ever published a title.
- A new **Contact & social links** navigation tab appears **for administrators only**. Admins can edit name, public email, phone, location, opening hours, official website, WhatsApp, Facebook, Instagram, YouTube, TikTok and X/Twitter URLs. Blank fields are not shown as links.
- Approved links appear on the public Book of the Week page and on the Library Manager site for guests, library users and admins. The rendering uses safe DOM text and checks HTTPS domains for social links.
- Lend and Return now use enhanced high-contrast pages, compact process steps, accessible book pickers and clear confirmation areas.
- Dropdown arrows are separate from text (no upside-down title animation); colors, cards, focus styles and mobile layouts have been refined.
- The legacy Google Sheets mirror remains **absent** from the frontend and network calls. Google Books is a separate catalog metadata service and is retained.

## Required Supabase steps before deploying (one-time)

1. **Back up your Supabase project** or use a staging environment first. Your existing `library_roles_and_circulation.sql` migration must already be installed, including at least one legitimate admin, and `library_book_of_the_week.sql` must already have created the `library_featured_books` table.
2. In Supabase **SQL Editor**, run the complete new `library_public_discovery_upgrade.sql` file.
3. Run the read-only verification queries at the bottom of that file. Confirm that `library_public_contact` exists and that `library_public_featured_book()` returns a row when there is a catalog title and no manual feature.
4. Deploy the contents of `librarymanger-main` to your repository and redeploy on Vercel.
5. Sign in as a verified admin. Open **Contact & social links** and save the official email/social URLs. Open the public advert in a private/incognito browser window and verify that every link goes to the correct destination.
6. For the automatic feature: open **Inventory → Book of the Week**, select **Use automatic weekly pick**, and visit the public advert page. A real catalog book with a nonblank title should appear. To override it, publish a catalog title from the admin form. To resume rotation, select automatic again.

## Security and behaviour

- Only `library_public_contact` public fields are readable by anonymous clients. The admin's `updated_by` account identifier is not publicly selectable. Database policies check verified `library_member_roles`, **not** the client role selector, before allowing changes.
- The public recommendation endpoint intentionally uses `SECURITY DEFINER` to read internal inventory and returns **only** title, authors, ISBN, recommendation text, publicly used cover link, shelf and feature date, plus whether it is manual or automatic. It does **not** return borrower or loan data, inventory IDs, account identities or internal notes.
- If your inventory has no books with a title, the advert shows an accurate placeholder instead of an invented book. If a book has no accessible cover photo, a built-in library photo is shown. Open Library cover URLs are best-effort and may not be available for every ISBN.
- Published manual choices remain active until explicitly replaced/cleared. Automatic picks rotate weekly without a cron job. The public page only reads a book when accessed; it does not write or update the database on each visit.
- Phone/email/social details become public by design; enter only official organizational contact information.
- Links are rendered with `rel="noopener noreferrer"`; profile links have HTTPS and platform hostname checks. Invalid or blank links are hidden.
- No production Supabase database changes were performed from this ZIP. Execute the migration deliberately and verify using real Admin and User accounts.

## Troubleshooting

- If the page only shows its placeholder, confirm you ran both Book of the Week SQL scripts and added a book with a title. A network failure or blocked anonymous RPC can also produce the placeholder.
- If Contacts shows a configuration error, run the new migration and check RLS policy creation and schema exposure in **Supabase → Integrations → Data API**. Never disable RLS to fix this.
- If social links do not appear, make sure URLs begin with `https://` and use the official platform's domain.
- Test the contact editor as a `user` account: it should be hidden in navigation, and direct database writes must fail even if attempted through the browser's API client.
