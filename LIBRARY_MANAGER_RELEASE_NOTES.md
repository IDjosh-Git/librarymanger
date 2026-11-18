# Library Manager — Consolidated Release Notes (RC62–RC69)

This document consolidates the original release notes and theme audit history from RC62 through RC69. Each release section preserves its original content, including verification limitations. The duplicate `THEME_AUDIT_HISTORY.md` contained the same text as `RC62_THEME_AUDIT.md` and is not repeated.

## Approved brand palette

- Primary: `#144E58`
- Secondary: `#1D727A`
- Sea-glass accent: `#49A6A3`

## Release history

# RC62 — Theme consolidation and static audit

Approved palette: primary #144e58, secondary #1d727a, added gradient accent #49a6a3.

- Migrated 43 legacy component blue colour tokens into the approved teal hue family while preserving their approximate lightness.
- Preserved semantic status families (success, warning, danger), neutral surfaces, and inventory functionality.
- Consolidated brand/action/focus variables and applied one shared theme stylesheet to all three pages.
- Ensured shared theme stylesheet loads after other external CSS files.
- Added visible keyboard focus and improved inline inventory editing contrast.
- No database schema, business logic, or inventory JS changed.

## Verification scope
Static checks: asset links, theme loading, migrated token count, package integrity.
Live browser visual testing, interactive regression testing, and full WCAG AA certification are **not** completed; those require a running deployment and test accounts/data. Some older inline and component-level declarations may still require targeted adjustments after visual testing.

---

# RC63 — Safe codebase cleanup and cache consistency

## Changes
- Updated release metadata from stale RC7 to RC63.
- Updated service worker cache namespaces from RC59 to RC63, allowing old `lm-` caches to be deleted during activation.
- Updated shell precache entries to current CSS versions and included the shared theme stylesheet that was missing from the cache list.
- Updated three HTML pages to use matching RC63 CSS cache keys.
- Refreshed branding and UX script cache keys on the main page.
- Added automated checks for local asset references, stylesheet ordering, service-worker cache consistency, and JavaScript syntax.
- Retained all application source files, because a static dependency audit found no safely demonstrable unused assets.
- Preserved all database, authentication, inventory, scanning, lending and return logic.

## Audit observations (not changed)
- The large main stylesheet and inline HTML code could be refactored, but doing so without full browser and Supabase regression testing would risk functionality.
- Existing `npm test` pointed to a missing tests directory; a small smoke test suite is now provided.
- No live browser, real authentication, database, or WCAG AA end-to-end testing was performed.
- Do not delete previous release backups until RC63 is validated in a staging deployment.

---

RC64 fixes literal \n in all three HTML heads, replaces three legacy navy base tokens, corrects theme-color metadata and theme toggle, and adds final brand overrides. Other historical component colours have not all been removed; live visual QA remains necessary.

---

# RC65 – Table header cleanup and dark theme contrast

- Removed the per-column filter buttons from generated inventory table headers.
- Preserved the single Filter toolbar button, filter dialog, global search, sorting and bulk shelf editing.
- Added scoped dark-theme foreground/background pairs for tables, forms, dialogs, and inputs.
- Updated asset query strings and service-worker cache version to rc65.
- Preserved the approved teal and sea-glass gradient.

## Verification scope
Static source inspection and automated release tests only. Browser-level accessibility and authenticated Supabase workflows remain to be tested in staging.

---

# RC66 — Unified header and hero visual system

- Standardised app header and public page top bars using approved teal theme.
- Standardised major workspace hero sections, typography, buttons, image treatment and mobile layout.
- Replaced remote inventory hero image with a bundled local image to prevent external image failure.
- Retained dynamic featured-book covers and reading-guide covers, with existing local fallbacks.
- Preserved existing links, navigation, IDs, buttons and event handlers.
- Added a single RC66 CSS layer, updated service-worker cache and package version.

## Validation limitations
Static and automated tests do not verify all browser breakpoints, dark-mode contrast or authenticated Supabase operations. Preview deployment and manual visual checks are required.

---

# RC67 — Sidebar, Logo, Reservations & AI visual refinement

- Scoped sidebar navigation palette, active indicators, hover/focus contrast.
- Recoloured the existing vector logo from legacy navy to approved teal (no brand rename).
- Refined reservation floating button, dialog, search, matches and history; preserved reservation Supabase calls.
- Refined AI floating control, chat header, sidebar, messages, prompt chips, inputs and dark-mode contrast; preserved AI service logic and chat-history handlers.
- Added responsive and reduced-motion rules.
- Bumped offline shell cache to RC67 and included new stylesheet.

No server or Supabase credentials were changed. Browser/device and authenticated workflow testing are still required.

---

# RC68 — AI Composer and Conversation Sidebar Refinement

- Horizontal, full-width, multiline message composer with right-aligned Send button.
- Existing textarea auto-height (up to 126px), Enter-to-send and Shift+Enter newline behavior preserved.
- Conversation list remains collapsible; sidebar scrolls independently.
- Messages scroll independently while the composer stays at the bottom.
- Mobile layout and dark-mode contrast improved.
- Existing AI request handling, conversation history, permissions and Supabase logic unchanged.
- RC68 stylesheet is loaded after RC67 styles; service worker cache bumped.

Validation: static references, JavaScript syntax, and archive integrity. Live browser/Supabase testing still required.

---

# RC69 — Responsive hardening

Based on RC68. Added a scoped responsive stylesheet loaded after the existing theme. Addresses horizontal page overflow, wide tables, hero layouts, reservation modal sizing, mobile AI chat and composer, safe viewport height, touch spacing, and reduced-motion preferences. Updated service-worker cache and package version. No Supabase, reservation, or AI business logic changed.

## Validation limitations
Static checks and automated unit tests do not establish correct rendering at all device widths or guarantee keyboard-open behavior on real mobile devices. Test at 320, 360, 390, 430, 768, 1024, 1440, 1920px; both themes; mobile landscape; 200% zoom; inventory editing, reservation, and AI chat.


## RC70 — Notifications Hero Height Fix

- Reduced excessive Notifications hero height by overriding legacy grid row sizing and vertical spacing.
- Kept the heading, explanatory copy, overdue counter and action buttons visible in a compact layout.
- Applied responsive stacking below 700px and narrow-phone button layout below 390px.
- Scoped all changes to `#notifications` so other page heroes remain unchanged.
- Updated application version, service worker caches and automated checks.
- Live visual/device testing remains recommended.


## RC73
- Corrected Floating AI header control contrast with explicit premium button surfaces.
- Widened the AI panel on desktop/window view.
- Upgraded sidebar action and conversation delete icons to SVG and improved placement.
- Added a final RC73 theme layer plus service-worker cache bump for Vercel refreshes.


## RC74
- Fixed collapsed AI sidebar retaining the RC73 forced desktop width.
- Chat content now reclaims the full space when sidebar is closed.
- CSS and service worker version bumped for cache refresh.

## RC75
- Compact one-row AI message composer (54px overall, 26px text region).
- Multiline input remains scrollable inside the compact field, with send button aligned to the right.
- Updated cache/version identifiers.

## RC76
- Redesigned Chat Options into an accessible premium expandable settings card.
- New blank chat on each Floating AI panel opening. Saved chats are available from history but never automatically restored.
- Preserved RC75 compact message input, RC74 collapse and RC73 wider panel.
- Updated service-worker cache and asset versions.
