# White Navigation & Scroll Containment — 3 November 2026

This update refines the signed-in Library Manager sidebar only.

- White background in light **and** dark themes, darker text, clean blue current-page state, subtle hover states.
- Removed dark animated menu gradient, decorative glows, and extra framing within the navigation.
- Book Lookup, quick tools, current account, and Book of the Week shortcut use light neutral surfaces.
- On desktop, the outer rounded sidebar clips overflow and the **inner content** scrolls with a slim inset scrollbar, avoiding a thumb extending beyond the card.
- On tablets and phones, account controls remain in normal document flow and there is no nested sidebar scroll.
- No changes to Supabase policies, authorization, book data, or Vercel functions.

**Deploy:** Replace the project files and redeploy on Vercel. Refresh cached styles.
