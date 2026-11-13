# Library Manager v5.52 — Idle scan progress visibility

**Issue:** The Scan page showed `Choose book photos to begin automatic scanning. 0 / 100 photos` even when no batch was running. The v5.51 progress meter rendered unconditionally. A connection-loss event could also display an unfinished-scan banner when no scan had been started.

**Changes:**

- The live progress section is hidden on first load; it appears only after a real scan preparation, ZIP import, selected photo queue, or restored scan job exists.
- A normal account refresh, scan completion, or Review-only task cannot leave the `0 / 100 photos` placeholder visible.
- The existing fixed-height progress design remains unchanged during actual scans (166px desktop / 181px mobile).
- The six-hour **Last completed scan** summary remains independent of live progress and can be displayed while the live meter is hidden.
- Invalid uploads now display a small, visible message beneath the upload fields instead of hiding the error with the idle progress meter.
- Losing connectivity while no scan exists no longer creates a phantom recovery banner.
- Updated the versioned stylesheet reference and offline service-worker cache to v5.52, preventing the previously cached interface from being served after deployment.

**Verification:** 189 automated Node tests passed, zero failed; Chromium layout tests at 320, 390, 768, 1024 and 1440px verify idle hidden, active visible, fixed progress heights, completed history visibility, readable upload errors, and no horizontal overflow. JavaScript syntax and ZIP integrity checked. No server schema changes, no user data or live book records altered.

**Deployment:** This ZIP must be deployed to the existing Vercel website to replace the old UI. As with previous versions, a real authenticated mobile smoke test is still recommended after publishing. Local tests did not execute a live cloud scan.
