# Cloudy Learning Intelligence + Admin API Vault Architecture

Status: architecture specification; not an implementation claim.
Repository: `lajonlipcik-lang/cloudy-english-academy`, branch `main`.
Scope: prepare the existing app for adaptive learning and administrator-managed AI providers without changing the current UI, lesson flow, SQL migrations, authentication, or production deployment in this phase.

## 1. Verified current constraints

- The original learner app is `public/cloudy-english.html`, loaded by `src/routes/index.tsx` in a full-screen iframe.
- The typed learning core is in `src/lib/cloudy/`; `applyAnswer` currently updates aggregate session counters and the legacy word-mistake map.
- The HTML app's account/profile flow has been documented as localStorage demo auth, not a verified Supabase learner session. This must be resolved before server-side per-learner records or admin-only secret management are enabled.
- Server-side Supabase utilities exist. `requireSupabaseAuth` validates a Supabase token, but the presence of middleware does not prove that the iframe app uses it.
- `supabase/migrations` and existing migration files are out of scope for this architecture-only phase.
- Lovable's project head and GitHub main were checked at commit `56b23e5c023b2c7b811a76867fb5370dacb0cb6d`.

## 2. Admin-managed API providers (API Vault)

### Product behavior

Add an administrator-only settings area, conceptually named **AI & API providers**:
- Add a provider by selecting a supported adapter, entering a display name, API key, optional model, and (only for approved compatible providers) endpoint.
- Test connection; show only success/failure, provider/model metadata, and a masked fingerprint. Never return the submitted key.
- Enable/disable, change priority, rotate, and delete a provider.
- Show health, last successful check, and quota/limit notes where provider metadata makes them available.
- Learners can use the configured AI features but cannot view, create, edit, export, or test stored credentials.

### Secret storage — important distinction

Do **not** store plaintext API keys in ordinary application tables, localStorage, HTML, client bundles, logs, analytics, or API responses.

Recommended storage design:
1. The admin submits a key over HTTPS to a server-only endpoint.
2. The server verifies a real Supabase session and an authoritative admin role/claim. It must not trust an email, role, or user ID supplied in the request body.
3. The server encrypts the key with authenticated encryption (AES-256-GCM). The encryption master key is a Lovable Cloud server Secret/environment secret, separate from the database.
4. Supabase stores only ciphertext, nonce/IV, authentication tag (or packed authenticated payload), key version, provider metadata, and timestamps.
5. Only server code with service-role access and the master encryption secret can decrypt a key, immediately before calling the provider.
6. The browser can receive safe metadata only: provider ID/name, adapter, model, enabled state, masked fingerprint, health status, and timestamps.

This means the encrypted credential record is in the Lovable-connected database, while the key that protects it is held in Lovable server Secrets. The database alone is not sufficient to reveal the provider key. If Lovable/Supabase Vault is explicitly verified and provisioned, it may be evaluated as an alternative; do not assume it is enabled.

### Database boundary

Proposed future table: `ai_provider_secrets` (name is provisional).
- Primary key/provider ID.
- Provider adapter and display name.
- Encrypted key payload, nonce, encryption key version.
- Optional approved endpoint and model configuration (non-secret).
- Enabled flag, priority, health status, last-tested/last-success timestamps.
- Created/updated actor IDs and timestamps.

Access:
- No SELECT/INSERT/UPDATE/DELETE grants for anon or authenticated browser roles.
- RLS enabled with deny-by-default policies for client roles.
- Server-only operations use the existing server-side Supabase admin client after explicit authorization.
- Do not expose decrypted views, RPCs, or service-role credentials to the browser.
- Audit metadata changes without recording secret values.

No migration is authorized by this document. Before implementation, inspect actual database state, auth claims, and RLS; then present the exact migration and obtain approval if schema changes are required.

### Admin authorization prerequisite

Current localStorage demo authentication is not an acceptable security boundary. Before the API Vault UI or mutation endpoints are enabled:
- Verify that the learner-facing app has a real Supabase Auth session.
- Establish an authoritative admin role using a server-verified JWT claim or protected server-side role table.
- Do not rely only on a hidden menu, a client-side email comparison, a URL, or localStorage.
- Enforce authorization independently on every server endpoint.
- If real auth/admin role is not ready, keep the API Vault unavailable rather than simulate security.

### Provider adapters

Use a provider adapter interface rather than hard-coding a single vendor:
- `id`, `displayName`, `protocol`, supported capabilities, model configuration.
- `validateConfig()`, `testConnection()`, `generateText()`, optional `transcribeAudio()`, optional `generateSpeech()`.
- Initial adapters can support OpenAI-compatible chat-completions APIs and explicit native adapters (for example Gemini and Groq) where request formats differ.
- “Any API” cannot mean arbitrary untrusted URLs without controls. Custom endpoints must require HTTPS, reject localhost/private/link-local/reserved IP ranges, prevent redirects to private networks, apply timeouts and response-size limits, and be protected against SSRF. Prefer a curated provider/endpoint registry first.
- Provider routing checks capability, enabled state, priority, model availability, quota policy, and failure cooldown. Never silently route to a paid provider when the configured policy is free-only.
- API errors returned to the client must be sanitized; never echo headers, keys, raw provider request bodies, or secrets.

## 3. Learning Intelligence pipeline

### Answer event

Every graded attempt should create a normalized event:
- exercise ID + content version;
- CEFR level and one or more stable skill IDs;
- exercise type and answer outcome;
- first attempt / retry / hint-used flags;
- coarse response-time bucket;
- timestamp and event schema version;
- optional normalized free-text answer only where semantic feedback needs it.

Do not collect keystrokes, device fingerprints, or raw audio by default.

### Skill profile

Maintain a bounded per-skill estimate:
- mastery 0..1;
- confidence/evidence count;
- recent outcomes;
- last-practiced and next-review timestamps;
- misconception tags;
- taxonomy version.

A single wrong answer must not sharply lower mastery. Unaided first attempts, hinted answers, retries, and skipped answers carry different evidence weights. AI output may suggest tags/explanations but cannot directly set mastery or placement level.

### Adaptive selector

Order selection:
1. due reviews;
2. evidenced weak skills;
3. a small amount of new material;
4. exercise-format variety.

Avoid repeating the same prompt; test the same skill with a different prompt. Keep existing deterministic lesson progression and XP/hearts/streak behavior intact.

### Question-quality feedback

Aggregate de-identified counts and flags only. Queue suspicious items for human/admin review; do not silently alter live curriculum. One learner's wrong answer is not evidence that a question is defective.

## 4. Proposed server boundaries

- `POST /api/admin/ai/providers` — create/update provider configuration and encrypt key.
- `GET /api/admin/ai/providers` — return safe provider metadata only.
- `POST /api/admin/ai/providers/:id/test` — server-side test; never return key.
- `POST /api/admin/ai/providers/:id/rotate` — replace secret and increment key version.
- `DELETE /api/admin/ai/providers/:id` — disable/delete provider credential.
- `POST /api/learning/answer` — validate answer event and update skill evidence.
- `GET /api/learning/profile` — authenticated learner's own profile.
- `POST /api/learning/feedback` — quota-limited semantic feedback.
- `POST /api/learning/speech/transcribe` — bounded upload; discard raw audio after processing by default.
- `POST /api/learning/questions/report` — quality signal.
- Admin-only batch question generation must remain separate from public learner endpoints.

All endpoints need schema validation, request limits, timeouts, rate limits, safe error handling, and server-derived identity.

## 5. Delivery sequence

### Phase 0 — architecture and security audit
- Confirm GitHub ↔ Lovable project head.
- Trace actual HTML auth/session flow and server auth middleware usage.
- Verify admin identity source and current database/RLS state without modifying it.
- Define stable skill taxonomy and provider adapter contracts.

### Phase 1 — local learning core
- Add versioned answer events, skill evidence, mastery update, review scheduling, and adaptive selection as pure TypeScript modules with unit tests.
- Integrate all answer paths (choice, listening, builder, matching pair, pronunciation, retries, skip) without redesigning the UI.
- Keep this profile device-local until real auth and persistence are approved; do not send local demo learner history to providers.

### Phase 2 — real auth and API Vault
- Complete/verify real Supabase Auth and server-side admin role.
- Agree on the exact encrypted-secret storage implementation and database migration.
- Build the admin API provider screen and server endpoints.
- Verify that no secret appears in browser bundles, responses, logs, or client-readable database access.

### Phase 3 — provider-backed tutor
- Add provider adapters, capability-aware routing, free-quota policy, fallback cooldowns, and sanitized errors.
- Start with text feedback; add speech only after iOS Safari recording and upload tests.
- No paid fallback unless the administrator explicitly enables it.

### Phase 4 — persistent learner profiles
- Only after real authentication and RLS review, persist events/profile per user.
- Add learner export/reset and retention controls.

## 6. Security and acceptance tests

- A non-admin cannot discover or mutate provider endpoints, even by calling them directly.
- Admin UI never receives the full key after save.
- Plaintext keys are absent from DB rows, browser network responses, bundles, logs, and analytics.
- Removing/rotating a key makes the previous key unusable.
- A database-only leak does not reveal provider keys without the separate master secret.
- Arbitrary endpoint validation blocks SSRF and private-network targets.
- Every answer path produces the expected event semantics; skips are neutral.
- Mastery changes are bounded and confidence-aware.
- Learner A cannot read learner B's profile.
- Exhausted free quotas do not trigger paid usage.
- Existing lessons, placement test, XP, hearts, streak, and design remain unchanged.
- CI passes; production is not published without explicit user approval.
