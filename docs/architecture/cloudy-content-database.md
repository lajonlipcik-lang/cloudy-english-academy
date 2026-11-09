# Cloudy Content database

## Current migration target

For the Vercel migration, Cloudy Core and Shorts/Content are planned to use **one Supabase project**. This matches the current server fallback in `src/integrations/supabase/content.server.ts` and avoids introducing a second Auth system or cross-project identity synchronization.

The separate Content-project mode remains supported by code as a future architecture option. It is not the current migration target.

## Data ownership

### Core
- Supabase Auth, accounts, sessions, profiles and account metadata.
- User progress, XP, lesson completion, learner profile and learning event journal.
- AI provider configuration and encrypted/provider-key vault.
- Privacy requests and optional-consent records.
- Community posts, comments, reactions, reports and rate limits (created by Core migration `0014`).

### Shorts/Content (same Supabase project, same `public` schema)
- Shorts video/post metadata, comments, likes, follows and saved posts.
- Moderation decisions, review queues, moderation events and user restrictions.
- Private `cloudy-shorts` Storage bucket.

Static lesson curriculum stays in application code for now.

## Authentication and trust boundary

Core Auth is the only identity provider. Every privileged Content operation must run server-side. The server validates the caller's Core access token with Core Supabase Auth (`auth.getUser(token)`), derives the user ID from that verified user, and only then accesses Shorts tables through `getCloudyContentAdmin()`.

Never trust a client-supplied author/user ID. Never expose a service-role key or privileged Supabase client to the browser. In the single-project target, leave `CLOUDY_CONTENT_SUPABASE_URL` and `CLOUDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY` unset so the helper falls back to Core.

## Migration ordering

The proposed single-project sequence is documented in `docs/migration/SUPABASE_MIGRATION_SEQUENCE.md`. Important constraints:

1. Apply Core migrations `0000–0015` first; Core `0014` already creates community tables.
2. Do not apply legacy Content migration `0001_cloudy_content_core.sql`: it duplicates community objects and may alter their grants.
3. Apply Content Shorts migrations `0002–0011` only after reviewing their security and ordering. The Content directory has two different files named `0009`, so a unique canonical migration history is required. New `0011_shorts_saved_posts_security.sql` enables RLS and limits saved-post access to `service_role`.
4. Apply Core Shorts RPC migrations `0016–0018` only after their referenced Shorts tables and columns exist.
5. Core `0019` and `0020` are later independent application migrations and must also be included in the final ordered history.
6. Add the new text-only moderation RPC migration after Core `0020`; never rewrite the historical `0017` file.
6. Do not apply anything to the connected destination until the complete sequence has passed on a disposable database.

The repository currently has no verified unified runner for both SQL directories. `drizzle.config.ts` points only to Core migrations; the Content track is not wired into Drizzle Kit. The canonical runner and migration history must be implemented and tested before database changes.

## Shorts moderation and publication

- Comments are created pending review and are made public only after the trusted server moderation flow approves them.
- A video caption passing text moderation does not approve the video itself. Video media remains unavailable until frame/audio analysis and human review complete.
- Photo publication uses the non-video media-review flow defined in Content migration `0008`.
- The application branch now runs actual AI text moderation for text-only Shorts and calls `apply_shorts_text_moderation`; it no longer returns a hard-coded `allow`.
- Core migration `0017` replaces the earlier RPC with a comments-only implementation. Preserve that historical migration unchanged and add a new CLI-generated migration after Core `0020` that restores support for text-only rows (`media_type = 'text'`) while refusing to change video/image rows. Until that additive migration is tested and applied, text posts safely fall back to manual review.
- Core migration `0018` contains the final definitions of `finalize_shorts_publication` and `moderate_shorts_video`, replacing earlier versions.

AI labels are evidence for review, not a verdict about the author. Automatic account restrictions must be proportionate, reasoned, recorded and reversible. Do not permanently ban solely on a low-confidence model result.

## Storage

Content migration `0004` creates the private `cloudy-shorts` bucket with a 100 MB limit and video MIME types. Content migration `0008` adds image MIME types. The server creates scoped signed upload URLs after Core Auth verification, validates the stored object, and controls publication. Do not add broad browser-role Storage policies.

The same bucket is used by Shorts media and profile image flows. Validate MIME restrictions, object path ownership, upload limits, signed URL expiry and delete behavior against the actual server functions before cutover.

## Security blockers to resolve before apply

- Content migration `0009_shorts_saved_posts.sql` creates `shorts_saved_posts` without RLS. The migration branch now contains `0011_shorts_saved_posts_security.sql`, which enables RLS, revokes `PUBLIC`, `anon` and `authenticated`, and grants only the required server role. Verify effective table privileges on a fresh Supabase database.
- Verify RLS and least-privilege grants for every Shorts table, not just the tables covered by Content migration `0002`.
- Inspect every `SECURITY DEFINER` function for a safe fixed `search_path`, validated inputs and service-role-only execution.
- Verify no service-role key is exposed through a `VITE_*` variable or browser bundle.
- Verify the Core Auth check occurs before every privileged Content read/write.

## Media processor

The frame/audio analysis flow uses the separate service in `services/cloudy-shorts-media`. It must be deployed as a private HTTPS service and configured with server-only `CLOUDY_MEDIA_PROCESSOR_URL` and `CLOUDY_MEDIA_PROCESSOR_TOKEN`. The processor receives a short-lived signed URL for one object; it does not need the Supabase service-role key.

Until the processor is deployed and configured, media analysis must fail closed to human review and videos must remain private. The app's Vercel deployment does not itself deploy this container.

## Data migration and rollout

- Preserve Auth user UUIDs and map every profile/progress/XP/AI Vault/community/Shorts row to the same identity.
- Preserve post/comment/reaction/report IDs, timestamps, moderation states and rate-limit data.
- Keep AI provider secrets server-side. Never export plaintext keys into logs or source control; validate encryption compatibility before moving encrypted records.
- Transfer private Storage objects while preserving bucket paths and verify every object with checksums/counts.
- Compare row counts, foreign-key relationships and representative records before enabling the new deployment.
- Keep the old Lovable database intact throughout validation and rollback. Do not drop or mutate its tables during the initial cutover.

## Current state

This document describes the target architecture, not a completed migration. No SQL migrations or data imports have been applied to the new destination. A successful Vercel build proves build/deployment only; it does not prove database parity or runtime behavior.
