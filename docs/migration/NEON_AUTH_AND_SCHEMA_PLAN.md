# Historical Neon migration proposal — superseded

This document describes an earlier proposal to replace Supabase with Neon PostgreSQL, Better Auth and Vercel Blob.

**That proposal is no longer the active migration direction.** The selected platform is Vercel + Supabase. Supabase remains responsible for Auth, PostgreSQL and Storage. Do not provision Better Auth, Neon or Vercel Blob based on this historical document.

Use these current documents instead:

- `docs/migration/SUPABASE_MIGRATION_AUDIT.md` — verified repository and destination findings.
- `docs/migration/SUPABASE_MIGRATION_SEQUENCE.md` — proposed single-project migration topology, file inclusion/exclusion and ordered sequence.
- `docs/architecture/cloudy-content-database.md` — current Core/Content ownership and server-side trust boundary.

The previous Neon/Better Auth analysis is retained in Git history, but its assumptions about replacing Supabase Auth, adapting RLS and replacing Supabase Storage are not instructions for the current migration.

No database migration or production cutover is authorized by this document. Keep the existing Lovable database intact until the new Supabase project has passed schema, data, authentication, Storage and application parity checks.
