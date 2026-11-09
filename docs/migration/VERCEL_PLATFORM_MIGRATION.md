# Vercel platform migration

Status: audit and preparation. Production and `main` remain unchanged.

## Target architecture

- Vercel: application hosting, deployments, and server-side functions.
- Neon PostgreSQL: relational data, constraints, indexes, SQL functions, and triggers.
- Vercel Blob: user-uploaded objects and Shorts media, with private access mediated by server routes.
- Better Auth (or another independently hosted auth layer): identity and sessions, subject to a proven account-migration strategy.
- AI providers: direct server-side integrations; credentials only in deployment environment variables or a dedicated secret store.
- Shorts media processing: a separately deployed private container service for FFmpeg; do not assume Vercel Functions can replace this workload without testing runtime limits.

Vercel alone does not replace PostgreSQL, identity, object storage, or a long-running media processor.

## Verified repository findings

- `package.json` includes `@lovable.dev/ai-gateway` and `@lovable.dev/vite-tanstack-config`.
- `vite.config.ts` imports the Lovable Vite/TanStack configuration package.
- `src/lib/chat.functions.ts` contains a legacy `claudyReply` function that checks `LOVABLE_API_KEY` and dynamically imports the Lovable AI Gateway. Repository code search found no call site or import of this function; the active iframe bridge dispatches chat requests to `cloudyTutorChat` in `src/lib/cloudy-ai.functions.ts`. The active tutor path calls configured providers directly (Groq, OpenRouter, OpenAI) through the AI Vault and fallback router, and retains learner context, age-aware safety, and request quotas. Keep the legacy module/dependency until a branch build confirms it can be removed safely.
- `drizzle.config.ts` now prefers `DATABASE_URL` and retains `LOVABLE_DB_MIGRATION_URL` only as a temporary fallback.
- `drizzle/schema.ts` is intentionally empty; the authoritative schema history is currently represented by SQL migrations, not Drizzle schema declarations.
- Core SQL migration history is present in `drizzle/migrations/` (0000–0020 in the source inventory).
- Content SQL migration history is present in `drizzle/migrations-content/` (0001–0010, including two distinct files numbered 0009; migration ordering must be reconciled before applying to a new database).
- Supabase client/auth modules are used throughout the application. `requireSupabaseAuth` validates bearer tokens using Supabase Auth claims; replacing it requires a new verified identity/session boundary, not just changing the database URL.
- `src/integrations/supabase/content.server.ts` uses a server-only service-role client and can fall back to the Core project when a dedicated Content project is not configured.
- `docs/architecture/cloudy-content-database.md` says Shorts/community data is currently co-located in Core and the separate Content project is optional. However, the media processor README describes a separate Content project as its runtime source. This documentation/configuration conflict must be resolved against live project configuration before data export.
- `services/cloudy-shorts-media/` is a separate FFmpeg container service. Its README describes private server-to-server authentication and signed private-storage URLs.
- The tracked `.env` file and current `.gitignore` require a credential/configuration hygiene review. Do not copy its values into migration artifacts; deployment configuration should be recreated from verified variable names and secret values entered directly into the hosting dashboard.

## Source project inventory status

- The connected Lovable project file listing was retrieved across both pages and includes the application, Core SQL migrations, Content SQL migrations, Supabase configuration, and Shorts media processor.
- The connected Lovable database query quota was exhausted during the latest attempt; no new inventory query was executed. Earlier read-only audit results recorded 5 auth users, 5 profiles, 26 public tables, 27 public RLS policies, 19 public SQL functions (overloads may affect counts), one Storage bucket, and seven Storage objects. These are provisional counts and must be re-verified before migration.
- Only the connected Lovable project's database is currently available through the integration. A second live Supabase project/database has not been independently verified. Do not infer its existence from documentation alone.
- No database dump, Auth export, or Storage object archive has been produced yet.

## Configuration inventory and build boundary

- The source `.env` file was inspected without displaying values. It contains only Supabase project identifiers, project URLs, and publishable client keys (including Vite-prefixed equivalents); no service-role key was found in that file. Publishable keys are not database passwords, but a tracked local `.env` should still be replaced by a committed placeholder-only `.env.example` and ignored local environment files.
- The build scripts are `vite dev`, `vite build`, and `vite preview`; CI commands include lint, typecheck, tests, and the media processor syntax check. The Lovable Vite config supplies framework/build plugins and defaults the Nitro target for the sandbox. The migration branch now selects Nitro's Vercel preset outside the sandbox; a clean production build and Preview deployment must still pass before this is considered verified.
- The current app dependency set includes Supabase JS and the Lovable AI Gateway; both are runtime dependencies, while the Lovable Vite/TanStack config is a development dependency. The legacy Gateway module appears unreferenced, but its package and generated type declarations remain pending removal until the lockfile can be regenerated and a clean build/test can run.
- `vite.config.ts` was adjusted on `migration/vercel-platform` to keep the Lovable sandbox defaults but select Nitro's `vercel` preset for non-sandbox builds. Manual `.vercel/output` directory overrides were removed; the Vercel/TanStack guidance relies on Nitro's Vercel integration and automatic output layout. This is a configuration change, not proof of a successful deployment.
- `drizzle.config.ts` now prefers `DATABASE_URL` and temporarily falls back to `LOVABLE_DB_MIGRATION_URL`; `.env.example` documents the target variable as server/CI-only.

## SQL migration source audit (read-only)

- The repository contains 21 Core SQL migration files (drizzle/migrations/0000–0020) and 11 Content SQL migration files (drizzle/migrations-content/0001–0010). The Content directory has two distinct files both numbered 0009 (shorts_follows and shorts_saved_posts); a target migration runner must use a deterministic filename-based ledger and must not assume numeric prefixes are unique.
- The SQL files are Supabase-specific, not directly portable Neon migrations: Core migrations reference auth.users, auth.uid(), auth.jwt(), Supabase roles (anon, authenticated, service_role), and the auth-user creation trigger. Neon target schema must be adapted to the chosen Auth provider and explicit server authorization model before application.
- Content migration 0004_shorts_private_storage.sql creates a private Supabase Storage bucket. That statement is not a Vercel Blob migration; Blob object access and authorization must be implemented separately. Content migrations also reference auth.users in the follows migration, despite the older Content DB comments describing Core Auth UUIDs as opaque references. This is an architectural inconsistency to resolve, not a safe assumption that Content can be deployed independently.
- Core migrations 0004–0015 repeatedly replace the XP award RPC and lesson-index constraints as curriculum expands. The final function/constraint state must be taken from the full ordered migration chain and compared to the live database, not reconstructed from an early migration or copied as an isolated function.
- Core migrations define learning progress, AI rate-limit leases, learner profiles, community/privacy records, moderation RPCs, Shorts publication RPCs, and chat history. A table-only dump would be insufficient; triggers, functions, indexes, grants, RLS policies, and sequence privileges are part of the application behavior.
- The connected Lovable database reports enabled=true, but SQL inspection is still blocked by the workspace's free-plan database action quota (the tool reported another 49-minute cooldown). No new production query ran and no source data was modified. Previously observed counts remain provisional until the quota resets.
- The Lovable file listing was fully paginated in this audit (194 files total across two pages). The repository's Core and Content SQL migration files are present in that listing. No SQL was applied to production or to a target database.

## Migration gates

1. Reconcile Core vs Content ownership and identify every live source project.
2. Inventory every table, view, enum, index, constraint, RLS policy, SQL function, trigger, auth user, Storage bucket/object, scheduled job, and Edge Function on each live source.
3. Obtain complete, restorable database backups and object exports. Never export provider secrets into Git, logs, or ordinary artifacts.
4. Reconcile migration numbering and apply schema in a deterministic order; reproduce constraints, indexes, triggers, RPCs, and authorization invariants on Neon.
5. Decide and test account migration. Password hashes and active sessions must not be assumed portable between auth providers. Preserve stable user IDs where feasible; otherwise implement a verified account-claim/password-reset flow and update references safely.
6. Copy Storage objects to Blob and verify object counts, byte sizes, MIME types, ownership, and private-access behavior.
7. Replace Lovable Vite configuration and AI Gateway usage with supported runtime/build and provider adapters; remove Lovable dependencies only after equivalent behavior is tested.
8. Deploy the media processor to a compatible private container host and verify its signed-URL and resource-limit behavior.
9. Run read-only parity comparisons and end-to-end tests against staging.
10. Switch production only after explicit validation. Keep source systems intact throughout the rollback window.

## Current blockers / external access required

- Vercel project access and deployment environment configuration.
- Neon database provisioning and a secure connection string.
- Vercel Blob provisioning and a server-side access token.
- A complete source database dump and Storage object export; the connected Lovable query quota is currently exhausted.
- Confirmation of whether a separate Content Supabase project is actually live and where its data resides.
- A proven Auth migration method before promising password-preserving account transfer.

## Safety rules

- Do not change `main` during preparation.
- Do not delete, truncate, or disable source data/services.
- Do not commit credentials, access tokens, connection strings, or API keys.
- Do not point production at an empty target database.
- Do not declare migration complete until schema/data/Storage/Auth parity and production smoke tests pass.
