# Vercel platform migration

Status: audit and preparation. Production remains unchanged.

## Target architecture

- Vercel: application hosting, deployments, and server-side functions.
- Neon PostgreSQL: application relational data and SQL functions/triggers.
- Vercel Blob: object storage for user uploads and Shorts media.
- Better Auth (or another independently hosted auth layer): identity and sessions, subject to a verified account-migration strategy.
- AI providers: direct server-side provider integrations; secrets stored only in deployment environment variables or a dedicated secret store.

This target removes the Lovable platform and Lovable-specific runtime dependencies. Vercel alone is not a replacement for PostgreSQL, identity, or object storage.

## Verified repository findings

- `package.json` contains `@lovable.dev/ai-gateway` and `@lovable.dev/vite-tanstack-config`.
- `src/lib/chat.functions.ts` imports the Lovable AI Gateway and checks `LOVABLE_API_KEY`.
- `drizzle.config.ts` reads `LOVABLE_DB_MIGRATION_URL`.
- `drizzle/schema.ts` is currently empty, despite existing SQL migration history.
- The application currently imports Supabase JS in auth, data, and server modules. These integrations must be replaced or deliberately retained only during a staged migration.

## Migration gates

1. Inventory every table, view, enum, index, constraint, RLS policy, SQL function, trigger, auth user, storage bucket/object, scheduled job, and Edge Function across all source projects.
2. Obtain a complete, restorable source backup. Never export provider secrets into Git, logs, or ordinary artifacts.
3. Recreate schema and server-side invariants on the target database; add automated parity checks.
4. Decide and test account migration. Password hashes and active sessions must not be assumed portable between auth providers. Preserve user IDs where feasible; otherwise implement a verified account-claim/password-reset flow and update foreign keys safely.
5. Copy storage objects and verify byte counts, MIME types, ownership, and access rules.
6. Run a read-only parity comparison and end-to-end tests against staging.
7. Switch production only after explicit validation. Keep source systems intact until rollback window expires.

## Current blockers / external access required

- A new Vercel project and deployment access are required to configure the project and production environment.
- A Neon project/connection string and Vercel Blob store/token must be provisioned by the account owner.
- Source database access is currently available through the connected Lovable integration; a complete database dump and storage-object export must be obtained before any cutover.
- Auth migration method must be proven before promising password-preserving account transfer.

## Safety rules

- Do not change `main` during preparation.
- Do not delete, truncate, or disable source data/services.
- Do not commit credentials, access tokens, connection strings, or API keys.
- Do not declare migration complete until schema/data/storage/auth parity and production smoke tests pass.
