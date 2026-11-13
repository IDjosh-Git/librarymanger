# v5.41 — Book recognition settings cards

- Simplified the two visible headings to `AI` and `OCR`, with one short explanatory line each.
- Rebuilt the account-settings cards as 100–106px-high, three-column layouts for icon, copy, and switch.
- Kept the underlying `batchUseAI` and `batchUseOCR` inputs and device preference persistence unchanged.
- Styled active, inactive, keyboard focus, dark theme, small mobile, and reduced-motion modes.
- This update has no schema changes and does not change scanning or book metadata behaviour.

## Checks

- `npm test`: 128/128 passes
- `python tests/browser_recognition_settings_v541.py`: passes at 320, 360, 390, 768, 1024, and 1440px
- Both switches toggle independently by mouse and keyboard; minimum card height at least 100px; no horizontal overflow.
