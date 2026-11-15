# RC26 Recognition improvement status

Implemented:
- Premium compact recognition settings, including independent OCR/AI switches, an OCR image-enhancement switch, and Balanced/Maximum accuracy modes, saved on device.
- Enhanced OCR retry can be disabled; Maximum accuracy bypasses the fast OCR mode. The source image is not modified by preprocessing.
- Review primary action relabelled Smart recognition, preserving existing OCR, catalogue lookup, AI fallback, per-book processing state, manual editing, cropping, cover replacement and approval.
- Per-book recognition feedback is kept on the card instead of overwriting a global status banner.
- Existing checksum validation, duplicate detection, catalogue suggestions and source warnings are retained.

Not implemented / not verified:
- Multi-photo fusion of front/back/title-page into a single recognition job.
- Formal calibrated field-level confidence scoring or edition-level source attestations.
- Persistent resumable recognition job queue, cancellation and server-side job history.
- Provider-side image processing privacy/retention audit.
- Authenticated browser/mobile end-to-end verification and Vercel deployment.

Automatic approval remains disabled. OCR and AI suggestions must be checked by an administrator.
