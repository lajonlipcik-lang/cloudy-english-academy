# Cloudy English — Supabase Migration Audit

Branch: `migration/vercel-platform`  
Repository: `lajonlipcik-lang/cloudy-english-academy`

## Current destination state

The newly connected Supabase project `vdzxsjvwowbmwqdamqus` was checked read-only:
- Project status: active and healthy; PostgreSQL 17.
- No application tables in `public`.
- No Auth users.
- No Storage buckets.
- No application migrations recorded.
- Security and performance advisor queries returned no lint findings at the time of inspection.

This is the new destination project, not the existing Lovable/Core database. No SQL migrations or data imports have been applied. Production, `main`, and the old database have not been changed.

## Repository findings

### Core and Content migration tracks

The repository contains two SQL migration tracks:
- `drizzle/migrations/`: Core migrations numbered `0000–0020`.
- `drizzle/migrations-content/`: Content migrations numbered `0001–0010`.

The Core track contains identity-dependent application data and features (profiles, learning progress/XP, AI Vault, chat and community-related functionality). Its later Shorts-related migrations include:
- `0016_shorts_publication_and_post_publish_review.sql`
- `0017_shorts_caption_nonblocking.sql`
- `0018_shorts_feed_and_review_rpc.sql`

These migrations reference Content tables such as `public.shorts_videos`, `public.shorts_comments` and `public.content_moderation_events`. Those tables are created in the Content track, not in the inspected Core base migrations. Therefore, applying the Core track alone is not a complete schema for the current Shorts RPCs.

### Content track and overlap

The Content track's `0001_cloudy_content_core.sql` creates community tables and functions. Core migration `0014_community_and_privacy_rights.sql` also contains community/privacy functionality. The exact intended ownership and overlap must be reconciled before applying both tracks to the same database.

The Content track's comments describe a separate Content database and opaque user UUID references, while application code uses both Core and Content Supabase clients. This is an intentional architectural possibility documented in the repository and must not be silently collapsed into a single database.

### Duplicate migration number

There are two distinct files numbered `0009` in the Content directory:
- `0009_shorts_follows.sql`
- `0009_shorts_saved_posts.sql`

The migration runner's ordering and identity rules must be checked. A runner that keys solely on numeric prefixes could skip or mis-handle one of these migrations. Renumbering must be done together with any migration-history/config updates, not by renaming files blindly.

### Runtime database routing

`src/integrations/supabase/content.server.ts` and Shorts server functions support a Core/Content split. The Shorts feed also reads author profile data from Core while loading media/content data from Content. Any chosen deployment topology must preserve this cross-database behavior and authentication boundary.

## Required work before applying SQL

1. Read the complete Core and Content migration files in order, including every `ALTER TABLE`, policy, grant, function, trigger, extension and Storage bucket operation.
2. Inspect the migration runner/configuration and confirm how it identifies migration files, especially duplicate `0009` prefixes.
3. Decide and document the target topology: one Supabase project with one unified schema, or separate Core and Content Supabase projects. Do not infer the answer from folder names alone.
4. Reconcile duplicate/overlapping community objects and Shorts RPC dependencies for the selected topology.
5. Ensure every RPC's referenced tables and columns exist before that RPC is created.
6. Verify RLS, grants, SECURITY DEFINER functions, search_path, Storage policies and private bucket access.
7. Build a deterministic, ordered migration plan and test it against a disposable empty Supabase project/database.
8. Only after schema validation, plan Auth users, profiles, progress, XP, AI Vault configuration, Storage objects and other data migration. Do not migrate secrets as plaintext or expose service-role credentials.
9. Verify row counts, relationships, auth identity mapping, Storage paths, RPC behavior and application flows before any production cutover.

## Safety constraints

- Do not apply migrations to the existing Lovable database.
- Do not modify `main` or Production as part of this audit.
- Do not delete or overwrite existing user data.
- Do not treat a successful Vercel build as proof of runtime/database parity.
- Preview-only configuration and disposable test infrastructure must be used for validation before production changes.
- Preserve the current Cloudy English UI, animations, sound effects and user-facing behavior during the platform migration.

## Audit conclusion

The destination Supabase project is currently empty and ready for schema preparation, but the repository's Core and Content migration tracks are not yet proven safe to apply as one sequence. The duplicate Content migration prefix and the Core-to-Content RPC dependencies are concrete blockers. No database changes should be made until the target topology and ordered migration plan are reconciled and tested.
