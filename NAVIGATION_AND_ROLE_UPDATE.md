# Library Manager — Role-aware Sign-in and Clean Navigation

## Updated interface
- The account form displays two clear choices: **User** and **Admin**. The chosen option stays visibly selected.
- New User accounts use the normal Supabase registration flow; the database signup role is `user`.
- New Admin accounts can select Admin, enter the current private administrator access code, and create their account. After account authentication and email verification (if configured), Supabase validates that code and grants the `admin` role. Role-based navigation is shown after the verified database role is loaded.
- Already-authorized administrators may sign in without re-entering a code. Selecting User on the form does not silently demote an existing administrator. An ordinary user cannot become an administrator by manipulating the role-choice UI.
- Admin workspace: Dashboard, Inventory, Scanned Books, Notifications, Loan History. Import-a-shelf is under the collapsed **Library tools** panel. Admin code generation and account controls are under **Account & access settings**.
- User workspace: Lend a Book, Return a Book. Admin screens and tools remain absent.
- Mobile: five admin shortcuts (Home, Inventory, Scans, Alerts, History); two user shortcuts (Lend, Return), with buttons sized to their role-specific count.

## Deploy
1. Keep your database and original inventory/loan data untouched. Confirm `library_roles_and_circulation.sql` from your previous release is already installed and an existing admin exists.
2. Back up Supabase. If not already installed, run `library_admin_access_code_upgrade.sql` once in Supabase SQL Editor. It does not execute automatically on Vercel deployment.
3. Deploy the ZIP project contents (the `librarymanger-main` folder contents) to Vercel.
4. An existing admin signs in and opens **Account & access settings → Administrator registration code**. Generate and privately share the code with trusted administrators.
5. Register a User test account and confirm only Lend and Return. Register an Admin test account with a valid code and confirm email if prompted; sign in and confirm the five admin destinations.
6. Check a failed/invalid code does not elevate the account, and confirm the database RLS is enforcing roles.

## Notes
- Role decisions are enforced by the Supabase database, **not** by HTML, JavaScript or client metadata.
- Free registration without a private code is supported only for ordinary users; allowing every visitor to self-assign Admin would expose and compromise your library data.
- Client-side design checks performed for role switching and responsive navigation. The live Supabase instance, Vercel deployment and real login writes were not tested in this environment.
- Other library workflows (scanning, Excel, history, notifications, Google Sheets integrations) were retained without database-schema changes in this UI revision.

## Sidebar refinement (2 November 2026)
- Signed-in desktop sidebar is wider: 332–390px depending on available viewport space.
- Main content remains flexible and avoids horizontal overflow.
- A dedicated signed-in identity card groups email and role; roomier primary navigation uses 60px rows with clearly separated icon tiles and active states.
- Library tools and account/access actions remain expandable, separate from core destinations.
- Mobile keeps role-specific shortcuts in an evenly spaced, centered bottom navigation dock.
- `assets/navigation-refinement.css` is loaded after the earlier styles so these changes reliably override old narrow-sidebar rules.
- No changes to Supabase authorization, role selection logic, database migrations, or API endpoints.

- Rebalanced active navigation and primary action gradients for white-label readability; improved sidebar label sizes, focus rings, and the mobile active-state contrast.
