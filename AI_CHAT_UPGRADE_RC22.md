# RC22 Library AI upgrade

Implemented: compact brand-aware floating AI button, premium header/panel refinements, accessible quick prompts for catalogue/availability/reservations, clickable matching catalogue title choices, optional browser speech-to-text input, reduced-motion and keyboard focus improvements. Existing Supabase private conversation history, authenticated inventory lookup, external catalogue matching, role-controlled backend and AI-provider failover remain in place.

Limitations: This release does not implement token streaming, multiple saved conversation threads, live AI-initiated reservation writes, or a dedicated administrator analytics agent. The AI can guide reservations but does not book on behalf of a user. Voice dictation depends on browser support and microphone permission. Existing 247 tests pass; new features have not been browser-tested on deployed Vercel.
