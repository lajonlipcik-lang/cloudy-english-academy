# Cloudy Content database

## Purpose

A separate data store for Cloudy community and Shorts. The existing Supabase project remains the identity, learning and AI Core. Cloudy AI is NOT moved to Content.

## Ownership boundaries

### Core (existing project)
- Supabase Auth, accounts, sessions, profiles and account metadata.
- User progress, XP, lesson completion, learner profile and learning event journal.
- AI provider secrets and AI configuration (including the existing AI Vault).
- Privacy requests and optional-consent records.
- Public-profile opt-in and canonical display name/bio.

### Content (new project)
- Community posts, comments, reactions and reports.
- Moderation state and moderation audit fields.
- Community post/comment rate limits.
- Shorts video metadata, comments and likes.
- AI moderation decisions, review queues, moderation events and user restrictions.

The static lesson curriculum stays in application code for now. Do not move it into Content until there is a concrete content-authoring/versioning requirement.

## Authentication and trust boundary

Core Auth is the only identity provider. Content does not create a second auth system and intentionally has no foreign keys to auth.users. The stable Core user UUID is stored as an opaque author_id/user_id/reporter_id/reviewed_by reference.

All Content database calls must be server-side. The server validates the caller's Core access token with Core Supabase Auth (auth.getUser(token)), derives the user ID from that verified user, and only then accesses Content. Never trust a client-supplied user ID. Never expose a Content service-role key or privileged Content client to the browser.\n\n## Cloudy AI moderation\n\nCloudy AI remains in Core. The existing AI provider configuration and encrypted/provider-key vault stay in Core and are never copied into Content. A trusted server moderation service loads enabled providers from the Core AI Vault, calls the existing AI routing/provider layer, and passes only the minimum required content context. It writes the moderation decision, labels, reason, confidence, model and policy version to Content.\n\nThe moderation pipeline covers Shorts video metadata/captions and comments, plus community posts/comments. Video files are stored privately; the server must inspect media using a supported moderation-capable pipeline before a video becomes public. Until actual video-frame/audio inspection is implemented and tested, do not claim that AI has reviewed the video itself: text-only caption checks are not sufficient to approve video media.\n\nUse a staged policy: clear allowed content can be approved; clear violations are rejected/hidden; uncertain or high-impact cases go to human review. Automatic account restrictions must be proportionate, reasoned, time-bounded where possible, recorded in an audit event, and reversible by an authorized moderator. Do not permanently ban solely on a low-confidence model result.

Public feed eligibility is checked against Core profiles.is_public. Resolve display names and bios from Core's safe profile projection; do not copy private profile data into Content.

## Provisioning

1. Create a separate Supabase project for Cloudy Content.
2. Apply drizzle/migrations-content/0001_cloudy_content_core.sql and 0002_shorts_and_ai_moderation.sql to the Content database only.
3. Configure server secrets CLOUDY_CONTENT_SUPABASE_URL and CLOUDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY.
4. Do not change existing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY or SUPABASE_SERVICE_ROLE_KEY; those continue to point to Core.
5. Configure a private Storage bucket for Shorts. Do not allow public uploads or publish media before the media moderation pipeline has approved them.

## Migration and rollout

- Keep existing community tables in Core until Content is provisioned, migrated and verified.
- Export/import existing posts, comments, reactions and reports with original UUIDs and timestamps; preserve moderation statuses and rate-limit counters where possible.\n- Existing AI provider records and AI configuration remain in Core and are not migrated.
- Verify row counts and sample records before switching reads/writes.
- Switch server endpoints to Content behind an explicit server configuration/feature flag.
- Keep a rollback window; do not drop Core community tables during initial cutover.
- Privacy requests and optional-consent events stay in Core.

## Security

- Content RLS is enabled with no policies for browser roles; only service_role can access data.
- The server enforces ownership, public visibility, input limits and rate limits before writes.\n- AI moderation is invoked server-side using Core AI credentials; Content stores decisions, not provider secrets.\n- A video is not considered AI-moderated until media frames/audio are actually inspected; caption-only moderation cannot approve the underlying video.
- Moderation RPC is callable only with service role and only after the Core admin check.
- Service-role credentials must never be committed to the repository.