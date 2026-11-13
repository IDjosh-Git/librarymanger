# Library Manager v5.47 — Admin-only settings and Book of the Week dark-mode contrast

## What changed
- **Admin-only configuration:** Sidebar `Account settings` (including AI/OCR recognition settings) and `Book lookup settings` are visible only to signed-in users with the verified `admin` role. Visibility is controlled in `authUI()` and reinforced by role-scoped CSS, including mobile navigation.
- **Member session controls:** Library Members retain a dedicated **Sign Out** control in their sidebar. On smaller screens, mobile navigation presents **Sign Out** instead of Account Settings. The existing optional **Activate admin access** code-redemption panel remains separately available to members, so the invitation workflow is not broken.
- **Admin functionality retained:** Admins still have Account Settings, Book Lookup Settings, AI/OCR toggles, Reload Database, Sign Out and the Administrators page.
- **Book of the Week dark contrast:** A navy/teal, high-contrast dark-mode treatment for the sidebar feature card and public Book of the Week editorial cards (title, description, labels, metadata, supporting text, links, and focus/hover states). Light mode remains unchanged.
- No database schema or production data changes.

## Verification
- `npm test`: **156 pass, 0 fail** (includes three new role/contrast checks).
- Chromium role-based UI checks at 320, 390, 768, 1024 and 1440px: Admin settings present only to Admin; Member sign-out available; mobile drawer shows only the role-appropriate action; no horizontal overflow.
- Public Book of the Week dark-mode editorial cards: contrast ratios **5.86:1** for primary copy, **5.07:1** for label, **5.16:1** for supporting text (measured against card background), across five tested widths. All exceed 4.5:1.
- Existing browser smoke checks: sidebar styling, Lending unique-title availability, Admin recognition switch sizing/interactions, and User/Admin registration flow pass.
- No authenticated production session, live deployment or live email/Book API verification was performed.

## Deployment
Deploy this ZIP to the existing `librarymanger` Vercel project. No Supabase migration is required for v5.47. After deployment verify the Menu and Book of the Week page while signed in as both a Library Member and an Administrator.
