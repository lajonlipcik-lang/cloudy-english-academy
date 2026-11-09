# Supabase migration sequence proposal

Repository: `lajonlipcik-lang/cloudy-english-academy`  
Branch: `migration/vercel-platform`  
Destination project: the newly provisioned Cloudy Supabase project.

## Recommended target topology

Use **one Supabase project** for the first Vercel migration:
- Core: Auth, profiles, learning progress, XP, AI Vault, community and privacy records.
- Shorts/Content: Shorts metadata, comments, likes, follows, saved posts, moderation records and the private `cloudy-shorts` Storage bucket.
- All privileged Content operations remain server-side through `getCloudyContentAdmin()`. Core Auth verifies the access token before a server function accesses Content tables.
- Do not configure `CLOUDY_CONTENT_SUPABASE_URL` or `CLOUDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY` for this single-project topology. The existing server helper falls back to Core `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Why this is the best fit for the current repository:
1. `content.server.ts` explicitly supports the single-project fallback.
2. The current architecture document says Shorts tables and private storage are co-located in Core by default.
3. Core migrations `0016`, `0017` and `0018` reference Shorts tables and moderation events in the same `public` schema.
4. Content migration `0009_shorts_follows.sql` has a foreign key to `auth.users`, so it is not compatible with the documented separate Content project where user UUIDs are supposed to be opaque references.
5. The user has provisioned one new Supabase destination project. A second project is not required for the current code path.

A separate Content project should be treated as a later, explicit architecture change. It would require moving the Shorts RPCs out of the Core migration track, removing cross-database assumptions and revisiting the `auth.users` foreign key.

## Migration files: include and exclude

### Core migrations

Keep the Core sequence `0000–0015` as the base sequence, subject to a final complete SQL review and a clean-database test.

Core migration `0014_community_and_privacy_rights.sql` already creates the community tables and privacy-related additions.

### Content migrations

For the single-project topology:
- **Do not apply** `0001_cloudy_content_core.sql`. It is a legacy separate-Content-project community schema. It duplicates community tables already created by Core `0014`, and its grants/revokes could alter access on those Core tables.
- Apply `0002_shorts_and_ai_moderation.sql` through `0008_shorts_photo_text_posts.sql` to create and extend the Shorts schema, private storage bucket, media-analysis metadata and moderation RPCs.
- Include `0009_shorts_follows.sql`, `0009_shorts_saved_posts.sql` and `0010_shorts_comment_interactions.sql`, but first resolve their duplicate numeric prefix as described below.

### Core Shorts RPC migrations

Apply Core `0016_shorts_publication_and_post_publish_review.sql`, `0017_shorts_caption_nonblocking.sql` and `0018_shorts_feed_and_review_rpc.sql` only after the Content Shorts tables and columns they reference exist.

The current Core `0018` definitions are the final versions of `finalize_shorts_publication` and `moderate_shorts_video`; they replace earlier definitions from Core `0016` and Content `0007`.

## Proposed deterministic order for a fresh database

This is the order to validate in a disposable database; it is not yet authorization to apply anything to the connected destination.

1. Core migrations `0000–0015`, in their existing numeric order.
2. Content `0002_shorts_and_ai_moderation.sql`.
3. Content `0003_shorts_text_moderation_rpc.sql`.
4. Content `0004_shorts_private_storage.sql`.
5. Content `0005_shorts_frame_analysis.sql`.
6. Content `0006_shorts_audio_analysis.sql`.
7. Content `0007_shorts_human_moderation.sql`.
8. Content `0008_shorts_photo_text_posts.sql`.
9. Content `0009_shorts_follows.sql`.
10. Content `0009_shorts_saved_posts.sql` (after renumbering).
11. Content `0010_shorts_comment_interactions.sql` (after renumbering).
12. Core `0016_shorts_publication_and_post_publish_review.sql`.
13. Core `0017_shorts_caption_nonblocking.sql`.
14. Core `0018_shorts_feed_and_review_rpc.sql`.

For a maintainable migration history, rename the two colliding Content files to a unique sequence (proposed: follows `0009`, saved posts `0010`, comment interactions `0011`). Update any migration manifest, documentation and runner references in the same change. Do not simply rename files until the migration runner's behavior and any existing migration history are confirmed.

## Known RPC replacement that needs an explicit regression test

Content `0008_shorts_photo_text_posts.sql` defines `apply_shorts_text_moderation` for both comments and video/text posts. Core `0017_shorts_caption_nonblocking.sql` later replaces it with a comments-only implementation that returns `false` for `short_video`.

The current server function `moderateOwnShortContent` is presently a no-op that returns an `allow` decision with `moderationApplied: false`; therefore, do not assume the database RPC is actively used for text-only posts. Before finalizing the sequence, verify intended behavior and add regression tests for:
- text-only post creation and publication state;
- comments allow/reject/review transitions;
- video caption moderation never approving the underlying media;
- photo publication through `finalize_shorts_nonvideo_publication`.

This is a code-behavior issue to resolve alongside schema validation, not a reason to skip the migration review.

## Security checks required in the disposable database

- Confirm every Shorts table has RLS enabled.
- Confirm browser roles `anon` and `authenticated` have no direct access to privileged Shorts tables; service-role grants are intentional.
- Confirm Storage bucket `cloudy-shorts` is private, has the expected MIME and size limits, and has no browser-role policies that bypass signed upload/download flows.
- Inspect every `SECURITY DEFINER` function for a fixed safe `search_path`, least-privilege grants and validated inputs.
- Confirm Core Auth token verification happens before privileged Content reads/writes.
- Confirm author IDs and profile projections are taken from verified Core identities, not trusted from browser payloads.
- Confirm no service-role key is exposed through a `VITE_*` variable or browser bundle.

## Stop conditions

Do not apply the proposed sequence to the connected Supabase destination until:
1. all Core and Content SQL files have been reviewed in full;
2. duplicate migration numbering and runner semantics are resolved;
3. the exact order succeeds on a disposable empty PostgreSQL/Supabase environment;
4. all RPC, RLS and Storage checks pass;
5. application build, typecheck and tests pass against the resulting schema.

No migrations have been applied by this document. It does not authorize production cutover, data deletion, changes to `main`, or changes to the existing Lovable database.
