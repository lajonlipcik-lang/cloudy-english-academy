# Cloudy Learning Intelligence

## Goal

Build an adaptive learning system that observes a learner's answers, identifies skill gaps, selects suitable follow-up exercises, and improves the shared question bank from quality signals. This is not model fine-tuning: the system learns a learner profile from recorded outcomes and uses that profile as context for later decisions.

## Current implementation constraints (verified on 2026-11-03)

- The production-facing UI is the original single-file app at `public/cloudy-english.html`, rendered by `src/routes/index.tsx` in a full-screen iframe.
- The HTML app currently uses `localStorage` for its account demo and learner state. Its `Auth` object stores email/password-derived demo data locally; it is not Supabase authentication.
- The floating Cloudy Ai panel still contains a placeholder message saying the AI chat is not connected.
- The typed learning core exists under `src/lib/cloudy/`. `CloudyState` tracks aggregate progress and a word-level mistake counter, while `Session` tracks correctness and attempts. It does not yet retain structured per-answer evidence, skill-level mastery, latency, hint usage, or a durable learner history.
- The root app allows microphone access to the iframe, but speech capture/transcription and AI evaluation are not connected as a complete server workflow.
- CI runs typecheck, lint, tests, and build. The main app HTML is not covered by the TypeScript checks.

## Product principles

1. Keep the existing Cloudy English visual design and the current lesson flow.
2. Never describe a wrong answer as proof that a learner does not know a skill. Store confidence and gather repeated evidence.
3. Keep private learner history isolated per authenticated user. Never pool raw personal answers or audio between learners.
4. Use aggregated, de-identified question-quality signals to find ambiguous or defective exercises.
5. Do not train or fine-tune model weights. Use structured learner memory and bounded context instead.
6. Free-only policy: never silently switch to a paid API. When free quotas are exhausted, pause AI features gracefully and preserve deterministic/offline exercises.
7. Do not store raw audio by default. Transcribe it, process it, and discard the recording unless the learner explicitly opts into retention.
8. Keep API keys server-side. The browser must never receive provider secrets.

## Target architecture

### A. Answer event

Every graded attempt should produce a compact event:

- authenticated learner ID (server-derived, never trusted from request body);
- exercise ID and content version;
- skill IDs and CEFR level;
- answer outcome and answer type;
- response time bucket (not precise keystroke telemetry);
- whether a hint or retry was used;
- timestamp;
- optional normalized response text only when needed for feedback.

Do not collect keystrokes, device fingerprints, or unrelated personal data.

### B. Learner knowledge profile

Maintain a profile per learner and skill:

- estimated mastery (0..1);
- confidence / evidence count;
- recent outcomes;
- last practiced timestamp;
- next review due timestamp;
- common misconception tags;
- level and skill taxonomy version.

Update mastery with a bounded evidence-based algorithm. A single mistake should make only a small adjustment; repeated independent evidence should have greater influence. Correct answers after hints and retries should count differently from unaided first attempts.

### C. AI analysis

Use deterministic code first for scoring, validation, deduplication, and scheduling. Call an LLM only when semantic interpretation is useful, such as diagnosing a free-text grammar error or generating a personalized explanation.

The AI response must be schema-validated and constrained to known skill IDs. AI suggestions cannot directly overwrite mastery scores or official placement levels.

### D. Adaptive exercise selection

Select the next exercise using:
1. due reviews;
2. weak skills with sufficient evidence;
3. a small amount of new material;
4. varied exercise formats.

Avoid repeating the exact same prompt. Prefer a new prompt testing the same underlying skill. Re-check mastery later before marking a skill as learned.

### E. Shared question quality

For each exercise, aggregate only counts and quality signals:
- unusual wrong-answer concentration;
- multiple plausible answers reported;
- high skip/abandonment rate;
- frequent AI/manual review flags.

Do not infer that a question is defective from one learner's mistake. Queue suspect items for review; do not silently rewrite live curriculum.

## Proposed server API

- `POST /api/learning/answer`: validate and store a graded answer event; update skill evidence.
- `GET /api/learning/profile`: return the authenticated learner's own skill map and review queue.
- `POST /api/learning/feedback`: request semantic feedback for a free-text answer, subject to quotas.
- `POST /api/learning/speech/transcribe`: accept a bounded audio upload and return transcription; do not persist audio by default.
- `POST /api/learning/questions/generate`: admin/background-only batch generation, never an unrestricted public endpoint.
- `POST /api/learning/questions/report`: record a question-quality flag.

All endpoints require server-side authentication, request-size limits, per-user rate limits, provider timeouts, schema validation, and safe error handling. The server derives the learner identity from a verified Supabase session.

## Provider routing (free-only)

- Gemini: primary semantic tutor and structured feedback, only while the account's free quota is available.
- Groq: fast text fallback and Whisper-compatible speech transcription, only while free quota is available.
- Cloudflare Workers AI: optional fallback after verifying the selected model and current free allowance.
- Browser speech synthesis: device-provided text-to-speech, no external API key.
- If all free providers are unavailable or over quota, return a typed `AI_QUOTA_EXHAUSTED` / `AI_PROVIDER_UNAVAILABLE` response and keep core exercises working offline.

Do not promise unlimited usage. Provider free tiers and terms can change; verify the actual account limits before enabling a provider.

## Privacy and safety

- The existing localStorage demo authentication is not sufficient for multi-user server-side learner memory.
- Do not send learner answer histories to a provider until real authentication and a privacy notice are in place.
- Minimize prompt context: send only relevant skill evidence, current exercise, and the learner's requested answer.
- Never use one learner's raw answer or audio as another learner's training data.
- Provide a way to reset/export learner history when durable storage is introduced.
- Treat model-generated explanations and question content as untrusted until validated.

## Delivery plan

### Phase 0 — foundations and audit
- Confirm real Supabase Auth/session integration and server-side identity propagation.
- Confirm available persistence and existing RLS policies before proposing any schema change.
- Add a stable skill taxonomy to exercises.
- Add tests for event validation, mastery updates, and adaptive selection.

### Phase 1 — local learning intelligence
- Add structured answer events and per-skill estimates to the existing learning core.
- Keep a local-only profile as a development fallback; label it as device-local and do not send it to AI.
- Integrate event recording into every answer path, including matching pairs, retries, skips, and speech exercises.

### Phase 2 — secure persistence
- After real auth is verified, persist learner profiles and events per user.
- Review RLS and data retention before any migration. Do not weaken existing policies.

### Phase 3 — AI tutor and semantic feedback
- Add server-side provider adapters and strict JSON schemas.
- Enable Gemini/Groq only after free keys are configured as server Secrets.
- Add per-user quotas and a graceful offline fallback.

### Phase 4 — speech
- Record audio with browser feature detection and iOS Safari testing.
- Transcribe through the server; compare transcription with the target phrase.
- Clearly distinguish speech recognition from phonetic/accent scoring. Do not claim Whisper alone measures pronunciation quality.
- Discard raw audio after processing by default.

### Phase 5 — question factory and quality loop
- Generate small batches, validate answers and CEFR tags, deduplicate, and stage for review.
- Publish only validated questions.
- Expand batch size gradually; 500,000 is a long-term corpus target, not a one-shot API call.

## Acceptance criteria

- A learner's history cannot be read or changed by another learner.
- One wrong answer does not cause a large mastery drop.
- Every exercise type records the correct event semantics.
- The next exercise reflects due reviews and evidenced weak skills.
- No provider key appears in client assets or browser network responses.
- Exhausted free quotas never trigger paid usage.
- iPhone Safari microphone denial, unsupported recording, network failure, and oversized audio are handled gracefully.
- Existing lessons, placement test, XP, hearts, streak, and visual design remain intact.
- CI passes and the production site is not published without explicit approval.
