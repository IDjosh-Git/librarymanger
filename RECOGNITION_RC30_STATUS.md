# RC30 recognition verification integration

Added Open Library ISBN/title verification after multi-photo evidence fusion. Verification uses an ISBN checksum, checks catalogue title agreement, reports mismatch/unavailable status, and never treats an AI suggestion as catalogue-verified solely on model confidence. Results are saved with recognition history and surfaced to the reviewer. No automatic approval is enabled. Four new automated tests cover success, mismatch, invalid ISBN, and provider outage.

## Unfinished, not production-verified
- Durable asynchronous server-side image processing after browser closure, cancellation and retry orchestration.
- Empirically calibrated field confidence, including edition and author corroboration.
- Privacy retention review and authenticated real-device/browser/provider end-to-end testing.
- Vercel deployment.

This release is an incremental improvement, not the complete feature set requested. No production deployment was performed.
