# Cloudy English — migration reconciliation audit

**Audit date:** 2026-11-11  
**Target database:** Lovable project `Cloudyenglishru` (`ea4a45c3-e064-48dc-9c89-4de1e8a4a27a`)  
**Repository ref:** `fix/cloudy-cross-provider-failover`  
**Scope:** Drizzle migration journal, migration SQL inventory, database catalog inspection, and guarded forward repairs.

## Executive result

The migration ledger is still behind the repository journal.

- Repository journal now contains 32 entries, `0000` through `0031`.
- The last successful ledger read returned 5 rows, matching `0000` and `0014`–`0017`.
- The database already contained most objects from `0019`–`0030), but not every migration statement had been applied.
- The orphan `0020_secure_privacy_center_writes.sql` was removed and its intended security change was rehomed as the ordered migration `0031_secure_privacy_center_writes.sql`.
- Migration `0026` was renamed to `0026_cloudy_ai_provider_allowlist.sql` and changed to allow only `groq`, `openai`, and `openrouter`. Gemini remains excluded, consistent with the current runtime direction.

**Do not manually insert synthetic migration ledger rows.** The database migration runner should reconcile entries only after the current schema is verified and the forward migrations are run in order.

## Changes executed against the target database

The Lovable database tool accepted these four SQL migrations without returning SQL errors:

| Migration | Change submitted | Result / verification |
|---|---|---|
| `0018_shorts_feed_and_review_rpc` | Replaced Shorts publication and moderation RPCs with the repository's v3 definitions and service-role-only execution grants | SQL accepted; post-write catalog verification blocked |
| `0025_cloudy_teacher_stars_price` | Set the active 30-day Cloudy Teacher plan to 300 XTR, guarded by its USD 4.00/month plan shape | SQL accepted; post-write data verification blocked |
| `0026_cloudy_ai_provider_allowlist` | Added provider CHECK constraint allowing Groq, OpenAI, and OpenRouter only | SQL accepted; post-write catalog verification blocked |
| `0031_secure_privacy_center_writes` | Revoked all direct table privileges from PUBLIC/anon/authenticated, granted authenticated read-only access, removed owner INSERT policies, retained owner-scoped SELECT policies, and granted service_role full access | SQL accepted; post-write privilege/policy verification blocked |

No paid Supabase branch or paid database resource was created.

## Per-entry reconciliation

Status meanings:
- **Recorded applied** — matching timestamp was present in the last successful database ledger read.
- **Objects present / compared** — key objects and definitions were inspected; not every historical statement is independently proven.
- **Applied; verification pending** — SQL was submitted successfully, but the post-write catalog query was blocked by the Lovable action quota.
- **Historical ledger gap** — no ledger row; timestamp predates the latest recorded migration, so the current Drizzle migrator's next step is after `0017`, not a blind replay of these older entries.

| Journal idx | Migration | Current evidence | Status |
|---:|---|---|---|
| 0 | `0000_cloudy_core` | Matching ledger timestamp and hash | Recorded applied |
| 1–13 | `0001`–`0013` | No ledger rows; older than latest recorded timestamp `0017` | Historical ledger gap; detailed historical comparison not completed |
| 14 | `0014_community_and_privacy_rights` | Matching ledger timestamp and hash | Recorded applied |
| 15 | `0015_expand_a1_a2_curriculum` | Matching ledger timestamp and hash | Recorded applied |
| 16 | `0016_shorts_publication_and_post_publish_review` | Matching ledger timestamp and hash | Recorded applied |
| 17 | `0017_shorts_caption_nonblocking` | Matching ledger timestamp and hash | Recorded applied |
| 18 | `0018_shorts_feed_and_review_rpc` | Database had v2 function bodies; v3 migration SQL was submitted | Applied; verification pending |
| 19 | `0019_cloudy_chat_history` | Table, constraints, index, and owner-scoped CRUD policies present | Objects present / compared |
| 20 | `0020_cloudy_subscriptions` | Subscription tables, constraints, indexes, and policies present; subscription view was subsequently replaced by `0024` | Objects present / compared |
| 21 | `0021_telegram_stars_payments` | Telegram tables, indexes, and payment/link RPC definitions present | Objects present / compared |
| 22 | `0022_cloudy_plans_and_telegram_checkout_bridge` | Plan column, payment-token table, and checkout RPC definition present | Objects present / compared |
| 23 | `0023_telegram_stars_refunds` | Refund RPC definition present and matches the migration body inspected | Objects present / compared |
| 24 | `0024_cloudy_lite_fallback` | `my_subscription_access` view uses `security_invoker=true` and the Lite fallback definition | Objects present / compared |
| 25 | `0025_cloudy_teacher_stars_price` | Price was NULL before the guarded update; update SQL was submitted | Applied; verification pending |
| 26 | `0026_cloudy_ai_provider_allowlist` | Provider constraint was absent; Groq-only rows were observed; allowlist SQL was submitted | Applied; verification pending |
| 27 | `0027_cloudy_ai_provider_failover` | Cooldown/error columns, provider-priority index, and status constraint present | Objects present / compared |
| 28 | `0028_cloudy_daily_token_quota` | Usage/reservation/event tables and quota RPCs present; later `0029` extends the schema and functions | Objects present / compared |
| 29 | `0029_cloudy_token_quota_config` | Config table and row present; observed daily limit 30,000 and warning ratio 0.800; extended usage-source constraint and configurable quota functions present | Objects present / compared |
| 30 | `0030_cloudy_ai_learner_context` | `user_learning_profiles` exists; both equivalent object-shape CHECK constraints were observed | Objects present / compared |
| 31 | `0031_secure_privacy_center_writes` | Former orphan security SQL rehomed into a forward migration and submitted | Applied; verification pending |

## Database facts observed before the write quota was reached

### Migration ledger

The five rows returned by the last successful ledger query had these timestamps and hashes:

- `1793692087750` — `0000`
- `1794000000000` — `0014`
- `1794003600000` — `0015`
- `1794003600001` — `0016`
- `1794003600002` — `0017`

The five hashes were independently recomputed from the repository SQL files and matched the database ledger.

### Quota and learner-context objects

Observed tables:
- `public.cloudy_daily_token_usage`
- `public.cloudy_token_reservations`
- `public.cloudy_token_usage_events`
- `public.cloudy_token_quota_config`
- `public.user_learning_profiles`

Observed functions:
- `cloudy_daily_token_limit()`
- `cloudy_token_warning_threshold()`
- `get_cloudy_daily_token_quota(uuid)`
- `reserve_cloudy_daily_tokens(uuid, uuid, integer)`
- `settle_cloudy_daily_tokens(uuid, integer, integer, integer, text, text, text)`
- `purge_cloudy_token_reservations(integer)`

Observed quota config: `daily_limit = 30000`, `warning_ratio = 0.800`.

RLS was enabled on the five inspected tables. The quota-table catalog query returned no policies. `user_learning_profiles` has two equivalent CHECK constraints: `user_learning_profiles_profile_check` and `user_learning_profiles_profile_object_check`. They were not dropped because duplicate checks are redundant but not a correctness blocker.

### Provider and subscription facts

- Provider vault rows observed were Groq only; no key material was selected or exposed.
- The provider-priority index, cooldown fields, error-code field, and status constraint were present.
- Before the price update, the active `cloudy_teacher` plan had `price_minor = 400`, monthly interval, and `telegram_stars_amount = NULL`.
- The current subscription view definition was `security_invoker=true` and exposed the Cloudy Lite fallback.
- Privacy Center tables had RLS enabled, but owner INSERT policies still existed before migration `0031`; that was the concrete security gap corrected by the submitted migration.

## Remaining work

1. Wait for the Lovable free-plan database action quota to reset, then read back the four changed areas: Shorts function definitions and ACLs; Cloudy Teacher Stars price; provider CHECK constraint; Privacy Center table grants, RLS, and policies.
2. Re-read `drizzle.__drizzle_migrations`. It was **not** modified by the direct SQL submissions. The last successful read still showed only five rows.
3. Run the repository's normal Drizzle migration command in the intended deployment workflow. Since the latest recorded timestamp is `0017`, it will process `0018`–`0031`. These migrations were reviewed for safe re-application (replace functions/views, guarded updates, IF NOT EXISTS / DROP-then-CREATE patterns), but the run still needs to be executed and verified rather than simulated by inserting ledger rows.
4. Run CI to completion and confirm the PR's checks pass.
5. Only then consider merging PR #152. The PR remains open and `main` has not been changed by this work.

## Current verification blocker

After the four SQL submissions, Lovable rejected the next read-only query with a free-plan database action quota message and a 57-minute retry window. Therefore the SQL submissions are recorded as accepted, but their final database state is not yet independently verified. No database migration ledger rows were fabricated.
