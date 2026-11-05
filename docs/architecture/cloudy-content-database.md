# Cloudy Content database

## Purpose

A separate Supabase project for Cloudy community data and the later Shorts publishing backend. The existing Supabase project remains the identity and learning Core.

## Ownership boundaries

### Core (existing project)
- Supabase Auth, accounts, sessions, profiles and account metadata.
- User progress, XP, lesson completion, learner profile and learning event journal.
- AI provider secrets and AI configuration.
- Privacy requests and optional-consent records.
- Public-profile opt-in and canonical display name/bio.

### Content (new project)
- Community posts, comments, reactions and reports.
- Moderation state and moderation audit fields.
- Community post/comment rate limits.
- Later phase: Shorts media metadata and private media storage, after upload limits, retention and moderation workflow are specified.

The static lesson curriculum stays in application code for now. Do not move it into Content until there is a concrete content-authoring/versioning requirement.

## Authentication and trust boundary

Core Auth is the only identity provider. Content does not create a second auth system and intentionally has no foreign keys to auth.users. The stable Core user UUID is stored as an opaque author_id/user_id/reporter_id/reviewed_by reference.

All Content database calls must be server-side. The server validates the caller's Core access token with Core Supabase Auth (auth.getUser(token)), derives the user ID from that verified user, and only then uses the Content service-role client. Never trust a client-supplied user ID. Never expose the Content service-role key or Content client to the browser.

Public feed eligibility is checked against Core profiles.is_public. Resolve display names and bios from Core's safe profile projection; do not copy private profile data into Content.

## Provisioning

1. Create a separate Supabase project for Cloudy Content.
2. Apply drizzle/migrations-content/0001_cloudy_content_core.sql to that project only.
3. Configure server secrets CLOUDY_CONTENT_SUPABASE_URL and CLOUDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY.
4. Do not change existing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY or SUPABASE_SERVICE_ROLE_KEY; those continue to point to Core.
5. Configure a private Storage bucket for Shorts only in a later upload phase. Do not allow public uploads or publish media before moderation.

## Migration and rollout

- Keep existing community tables in Core until Content is provisioned, migrated and verified.
- Export/import existing posts, comments, reactions and reports with original UUIDs and timestamps; preserve moderation statuses and rate-limit counters where possible.
- Verify row counts and sample records before switching reads/writes.
- Switch server endpoints to Content behind an explicit server configuration/feature flag.
- Keep a rollback window; do not drop Core community tables during initial cutover.
- Privacy requests and optional-consent events stay in Core.

## Security

- Content RLS is enabled with no policies for browser roles; only service_role can access data.
- The server enforces ownership, public visibility, input limits and rate limits before writes.
- Moderation RPC is callable only with service role and only after the Core admin check.
- Service-role credentials must never be committed to the repository.