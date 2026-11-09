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
- `src/lib/chat.functions.ts` checks `LOVABLE_API_KEY` and dynamically imports the Lovable AI Gateway. It already routes through the app's AI fallback router, which is a useful seam for replacing the provider adapter.
- `drizzle.config.ts` reads `LOVABLE_DB_MIGRATION_URL`.
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
- The build scripts are `vite dev`, `vite build`, and `vite preview`; CI commands include lint, typecheck, tests, and the media processor syntax check. The Lovable Vite config currently supplies framework/build plugins and defaults the Nitro target to Cloudflare. Replacing it requires an explicit Vercel-compatible TanStack Start/Nitro configuration and a production build test.
- The current app dependency set includes Supabase JS and the Lovable AI Gateway; both are runtime dependencies, while the Lovable Vite/TanStack config is a development dependency. Removal must be sequenced after replacement adapters and integration tests are in place.

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
