# RC51 — Colour classification and regression audit

## Classification (heuristic, requires manual semantic review)
- Neutral surfaces and low-saturation colours: 383
- Blue/cyan/teal **brand or informational** candidates: 1,865
- Green **success** candidates: 185
- Amber/orange **warning** candidates: 188
- Red **danger** candidates: 137
Total: 2,758 legacy colour tokens.

The categories are based on hue/saturation and are NOT a definitive component-by-component semantic mapping. Some coloured values are alpha overlays or may be intentionally non-semantic. Existing legacy values were preserved to prevent unintended colour changes.

## Applied
- Reorganised the central colour registry into explicit token families without changing their values.
- Bound major named brand/accent/hover tokens to dynamic App Appearance values in all three component stylesheets.
- Preserved semantic status colours as independent of brand settings.
- Updated stylesheet and branding cache keys to RC51.

## Verified
- 268/268 automated tests passed.
- All JavaScript syntax checks passed.
- All referenced legacy colour tokens resolve; 0 missing.
- Existing dark-theme CSS rules remain present; branding runtime listens for theme changes.
- ZIP integrity checked.

## Not verified
- Live visual inspection of every screen in light and dark modes.
- WCAG contrast ratios of every rendered component.
- Full elimination of literal colours in HTML, JavaScript, SVG, and registry.
- Perfect classification of all 2,758 values.
- No colour mismatches anywhere in the application.

A true complete migration requires reviewing each component in a browser and replacing the legacy values with a small, intentional set of semantic tokens, rather than merely classifying values by hue.
