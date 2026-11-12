# Library Manager v5.26 — Premium Daily Usage Register

## Starting point

Built on the most recent Library Manager project archive in the user's Library:
`LibraryManager_v5.25_Supabase_AI_App_Knowledge_Reset_20261112.zip`.
This update is for **Library Manager** (`librarymanger`), not Prompt Atelier.

## Two separate, role-specific pages

### Member: My Daily Visit Log — `/#dailyLog`

- Access: signed-in accounts with a **Library user** role (not anonymous visitors and not unregistered shared Supabase accounts).
- Navigation: **Your Library Visits → Check in / out**. This is the default landing page for the `user` role after login; existing Lend and Return pages remain available.
- Check in: enter an identifiable name and visit purpose. The **database** records the actual check-in timestamp and verified Supabase email identity. A website login or account registration *alone* is **not** a check-in.
- Reading activity: add up to 12 titles, assisted by the available catalogue titles in the browser if loaded. Save the reading list to Supabase independently or submit it with check-out.
- Check out: after confirmation, the database stores the actual departure timestamp, books read and optional notes. A completed visit cannot be edited.
- Personal dashboard: visit count, open/closed status, books recorded and last visit. Personal visit history includes check-in, check-out, duration, purpose and book titles.
- Only one open visit is allowed per person. A member must close a previous unfinished visit before starting another.

### Administrator: Daily Usage Register — `/#attendance`

- Access: signed-in accounts with a verified **Library Manager administrator** role.
- Navigation: **Monitor & Reports → Daily usage log**.
- KPIs: total check-ins, visits without check-out, completed visits and book titles recorded.
- Log list: member's self-entered display name, verified account email, check-in date/time, check-out time, visit duration, number of book titles and status.
- Expand any log for purpose, full books read, optional notes and database visit identifier.
- Filters: from/to date, status (all / still checked in / checked out), search by name/email/book. Defaults to the current date in **Africa/Lagos (WAT)**.
- Server-pagination (20 records/page) to keep large registers responsive, and CSV export for the selected filters (up to 10,000 visits per export; narrow the date range for larger reports).
- **No account-directory records are included.** Only members who explicitly checked in have visit rows. An open record means *no check-out has been recorded*, not necessarily that the person is physically on-site.
- Admin is read-only for daily attendance; no unverified manual adjustment of clock times or user-specific rows.

## Supabase configuration

Applied to the connected `DataLearning` Supabase project `hotysnqorkqbiconjskl`, which already hosts Library Manager and other independent apps. This release creates/changes only Library Manager-specific visit tables, RPCs, and Library Manager AI help entries.

| Database object | Purpose |
| --- | --- |
| `public.library_daily_visits` | One row for each explicit member check-in; role-protected visitor identity and server-controlled timestamps |
| `public.library_visit_books` | One row per recorded title for a given visit |
| `library_daily_check_in(...)` | Role-verified, server-timed check-in |
| `library_daily_record_books(...)` | Save/edit titles while a visit is open |
| `library_daily_check_out(...)` | Transactionally save titles/notes and server-stamp check-out |
| `library_daily_admin_report(...)` | Administrator-only, paginated and filtered usage report |

The full deployment-safe SQL is `database/08_library_daily_visit_register.sql` for another environment. The connected project migration is already applied. Do **not** run it again simply to activate the UI.

- RLS is enabled on both visit tables. Members see only their own visits; admins can read all confirmed visit records.
- Anonymous `SELECT` is denied. A normal member cannot call the admin reporting RPC.
- No authenticated browser client has privilege to insert `checked_in_at` or update `checked_out_at`; the database stamps both.
- An incomplete visit remains open until explicitly checked out. Website sign-out doesn't auto-complete a physical visit, because closing a tab or losing connectivity is not proof of leaving the library.
- Admin permissions come from `library_member_roles`, not user-editable metadata.
- The floating Library AI's knowledge base now includes three new topics about member check-in/out, the administrator report and attendance privacy (33 enabled Library Manager help articles in Supabase).

## Design and deployment

- Premium navy/teal hero, restrained orange accents, mobile-responsive layout, accessible field labels, large tap targets, toast/status feedback, account-aware navigation and collapsible per-visit admin details.
- Files: `assets/daily-visit-register.css`, `assets/daily-visit-register.js` and updated `index.html`.
- No Vercel environment-variable changes are required; reuse the existing `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` and normal Supabase member sessions.
- **Live Vercel deployment has not been performed.** Deploy this project to `librarymanger` and test with a real member/admin pair before going live. The published site will not show the new pages until the deployment.

## Verification

- **16 automated tests passed** including seven new visit-register tests (existing nine AI tests retained).
- Main inline app JavaScript, new visit JavaScript and existing book-guide JavaScript pass `node --check`; no duplicate IDs in the HTML.
- A direct transactional Supabase smoke test performed check-in, added books, checked out and verified that a library admin could read the record. Duplicate concurrent open visits were rejected. All test records were **rolled back**; live attendance remains empty until a real member checks in.
- A separate security test confirmed regular members cannot run the admin report, anonymous clients cannot read visit tables, and members cannot forge the check-in/check-out timestamp columns. Supabase Security Advisors had no new findings specific to the visit tables/functions (other unrelated app warnings exist in the shared project).
- Desktop admin and mobile member layouts were exercised in a browser **using mock attendance data**, including user check-in, book selection, save, check-out, admin detail expansion, and mobile overflow check. Screenshots are illustrations, not real attendance records. Local preview-server browsing was blocked by the browser policy; the browser `set_content` test worked with no JavaScript errors.
