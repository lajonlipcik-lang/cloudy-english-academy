# Cloudy English — migration reconciliation audit

**Audit date:** 2026-11-11  
**Target database:** Lovable project `Cloudyenglishru` (`ea4a45c3-e064-48dc-9c89-4de1e8a4a27a`)  
**Repository ref inspected:** `fix/cloudy-cross-provider-failover`  
**Scope:** Drizzle migration journal, migration SQL inventory, and read-only database metadata inspection.

## Executive result

The migration ledger is not synchronized with the repository journal.

- Repository journal: 31 entries, `0000` through `0030`.
- Database `drizzle.__drizzle_migrations`: 5 rows.
- The 5 database timestamps correspond to journal entries `0000` and `0014`–`0017`.
- A second SQL file, `0020_secure_privacy_center_writes.sql`, exists in the migrations directory but has no matching entry in `drizzle/migrations/meta/_journal.json`. It is therefore not part of the normal Drizzle journal sequence.
- Quota/learner-context objects introduced by later migrations are present in the database, but their migration history rows are absent. This is evidence of schema changes having been applied outside the recorded Drizzle sequence; it does **not** prove that every statement in those migrations was applied exactly as written.

**Do not run all missing migrations blindly. Do not insert synthetic rows into `drizzle.__drizzle_migrations` yet.** Both actions can conceal schema drift or cause duplicate/unsafe DDL.

## Per-entry reconciliation

Status meanings:
- **Recorded applied** — matching timestamp exists in the database migration ledger.
- **Objects present; full diff pending** — relevant objects were found, but every statement/definition has not yet been compared.
- **Not recorded; application unknown** — no matching ledger row; this is not proof that the SQL was never applied.

| Journal idx | Migration | Database evidence | Status |
|---:|---|---|---|
| 0 | `0000_cloudy_core` | Matching ledger timestamp | Recorded applied |
| 1 | `0001_cloudy_ai_vault` | No ledger row; detailed schema comparison blocked by DB action quota | Not recorded; application unknown |
| 2 | `0002_cloudy_ai_vault_admin_rls` | No ledger row; policy-level comparison pending | Not recorded; application unknown |
| 3 | `0003_cloudy_ai_provider_api_key` | No ledger row; column/index comparison pending | Not recorded; application unknown |
| 4 | `0004_server_authoritative_xp` | No ledger row; function/trigger comparison pending | Not recorded; application unknown |
| 5 | `0005_progress_sync_concurrency` | No ledger row; function/index comparison pending | Not recorded; application unknown |
| 6 | `0006_cloudy_ai_rate_limits` | No ledger row; table/function comparison pending | Not recorded; application unknown |
| 7 | `0007_progress_account_cascade` | No ledger row; FK comparison pending | Not recorded; application unknown |
| 8 | `0008_persist_learner_level_and_fix_progress_version` | No ledger row; schema/function comparison pending | Not recorded; application unknown |
| 9 | `0009_return_xp_progress_version` | No ledger row; function comparison pending | Not recorded; application unknown |
| 10 | `0010_extend_a1_lesson_xp` | No ledger row; function/data comparison pending | Not recorded; application unknown |
| 11 | `0011_expand_a2_curriculum` | No ledger row; function/data comparison pending | Not recorded; application unknown |
| 12 | `0012_complete_a2_curriculum` | No ledger row; function/data comparison pending | Not recorded; application unknown |
| 13 | `0013_cloudy_learning_event_journal` | No ledger row; table/function comparison pending | Not recorded; application unknown |
| 14 | `0014_community_and_privacy_rights` | Matching ledger timestamp | Recorded applied |
| 15 | `0015_expand_a1_a2_curriculum` | Matching ledger timestamp | Recorded applied |
| 16 | `0016_shorts_publication_and_post_publish_review` | Matching ledger timestamp | Recorded applied |
| 17 | `0017_shorts_caption_nonblocking` | Matching ledger timestamp | Recorded applied |
| 18 | `0018_shorts_feed_and_review_rpc` | No ledger row; function/table comparison pending | Not recorded; application unknown |
| 19 | `0019_cloudy_chat_history` | No ledger row; table/index comparison pending | Not recorded; application unknown |
| 20 | `0020_cloudy_subscriptions` | No ledger row; table/function comparison pending | Not recorded; application unknown |
| — | `0020_secure_privacy_center_writes` | File exists but is absent from the journal | Orphan SQL; application unknown |
| 21 | `0021_telegram_stars_payments` | No ledger row; table/function comparison pending | Not recorded; application unknown |
| 22 | `0022_cloudy_plans_and_telegram_checkout_bridge` | No ledger row; table/function comparison pending | Not recorded; application unknown |
| 23 | `0023_telegram_stars_refunds` | No ledger row; table/function comparison pending | Not recorded; application unknown |
| 24 | `0024_cloudy_lite_fallback` | No ledger row; config/function comparison pending | Not recorded; application unknown |
| 25 | `0025_cloudy_teacher_stars_price` | No ledger row; config/data comparison pending | Not recorded; application unknown |
| 26 | `0026_cloudy_ai_gemini_provider` | No ledger row; provider schema comparison pending | Not recorded; application unknown |
| 27 | `0027_cloudy_ai_provider_failover` | No ledger row; provider schema/function comparison pending | Not recorded; application unknown |
| 28 | `0028_cloudy_daily_token_quota` | Quota usage, reservations and events tables plus quota RPC functions exist; exact SQL diff pending | Objects present; full diff pending |
| 29 | `0029_cloudy_token_quota_config` | Config table exists; observed daily limit 30,000 and warning ratio 0.800; exact SQL diff pending | Objects present; full diff pending |
| 30 | `0030_cloudy_ai_learner_context` | `user_learning_profiles` exists; duplicate equivalent CHECK constraints observed | Objects present; full diff pending |

## Database facts observed

### Migration ledger

The five rows currently present have these `created_at` timestamps (UTC):

- `1793692087750` — journal entry `0000`
- `1794000000000` — journal entry `0014`
- `1794003600000` — journal entry `0015`
- `1794003600001` — journal entry `0016`
- `1794003600002` — journal entry `0017`

The absent ledger timestamps include the later entries `0018`–`0030`, despite objects from `0028`–`0030` being present.

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

RLS is enabled on all five inspected tables. The inspected catalog query returned no policies for those tables. The quota tables have primary keys and validated checks/FKs. `user_learning_profiles` has two equivalent profile-object CHECK constraints, named `user_learning_profiles_profile_check` and `user_learning_profiles_profile_object_check`.

## Safe repair plan — do not execute until the full diff is available

1. **Freeze migration writes.** Do not run `drizzle-kit migrate` against this database while the ledger and schema are inconsistent.
2. **Take a database backup/snapshot** using the existing free/available project capability before any write. Do not create a paid branch or paid resource.
3. **Collect a complete read-only schema snapshot:** tables, columns, types, defaults, nullability, PK/FK/unique/check constraints, indexes, RLS flags/policies, grants, triggers, views, functions (full definitions), and relevant seed/config rows.
4. **Compare every SQL file statement-by-statement** against that snapshot. Classify each statement as exact match, semantically equivalent, missing, or conflicting. Compare the two `0020` files separately.
5. **Resolve the orphan migration.** Determine whether `0020_secure_privacy_center_writes.sql` was applied manually. Decide whether to fold its contents into a properly ordered, journaled migration or keep a documented one-off repair. Do not rename/reorder an already deployed migration without checking every environment.
6. **Prepare a forward-only reconciliation migration** containing only genuinely missing changes. Make DDL idempotent where safe, but do not use `IF NOT EXISTS` as a substitute for validating existing definitions.
7. **Test on a disposable local/test database** with both a clean install and an upgrade from the current schema. Verify that user data is preserved.
8. **Apply the forward-only repair to the target database** only after review and explicit approval. Verify schema and runtime behavior.
9. **Reconcile the Drizzle ledger last.** Add ledger records only for migrations proven to have been fully applied with matching content/hash and correct order. For partially applied migrations, repair missing statements first; do not mark them complete prematurely.
10. **Run the migration suite and application CI**, then verify the target DB again.

## Current blocker

The Lovable free-plan database MCP action quota was exhausted during the read-only audit. Additional SQL queries were rejected with a 60-minute retry notice. Consequently, this document deliberately does not invent statuses for the 26 unrecorded entries and does not include any write SQL.

**No database rows, migration history, or schema objects were changed during this audit.**
