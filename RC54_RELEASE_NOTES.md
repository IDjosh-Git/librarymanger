# RC54 — Inventory and Settings Refinements

- Inventory **Distinct titles** now counts `inventoryGroups().length` rather than physical-copy records (`books.length`).
- Inventory table copy column now reads **Physical Copies**, consistent with its existing `g.totalCopies` data.
- Book lookup disclosure icon rotates with the `open` state, including explicit transform origin and cascade precedence.
- Removed the redundant optional connection badge and replaced the subtitle with concise catalogue lookup wording.
- Reduced lookup card header and body spacing. API key input and its security guidance remain available.
- Removed redundant descriptions from AI/OCR tiles and consolidated recognition help.
- Assigned distinct icons to Recognition (scan), Appearance (sun), Lookup (book).
- Ensured light icons on brand-filled settings emblems in both themes.
- No schema, authentication, permissions or database writes changed.

## Verification
- `npm test`: exit 0; # pass 273; # fail 0
- JS syntax errors: []
- Live authenticated browser visual verification not performed.
