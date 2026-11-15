# RC35 — Premium UX and accessibility

Base: RC34. This is a presentation-only release: no inventory, recognition, approval, authentication, or database logic changed.

## Changes
- Consistent premium cards, spacing, typography, subtle elevation, and responsive organization on the Review workspace.
- Clearer three-step review flow, queue counters, filter controls, multi-photo recognition cards, and advanced tools.
- Larger interactive targets, visible keyboard focus, readable placeholders, responsive small-screen layout, and reduced-motion/high-contrast support.
- Existing branding variables respected. Existing three stylesheet architecture preserved.
- CSS cache-busting query parameter added to the main stylesheet.

## Verification
- Node automated regression tests: 268/268 passed.
- ZIP integrity check performed.
- Not tested in an authenticated live browser or against every custom branding combination. Preview verification recommended before production.
