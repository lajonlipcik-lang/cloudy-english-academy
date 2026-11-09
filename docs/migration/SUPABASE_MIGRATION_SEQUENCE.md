# Supabase migration sequence proposal

Repository: `lajonlipcik-lang/cloudy-english-academy`  
Branch: `migration/vercel-platform`  
Destination: the new Cloudy Supabase project.

## Target topology

Use one Supabase project for the first Vercel migration:
- Core: Auth, profiles, learning progress, XP, AI Vault, community and privacy records.
- Shorts/Content: Shorts metadata, comments, likes, follows, saved posts, moderation records and private `cloudy-shorts` Storage bucket.
- All privileged Shorts operations stay server-side through `getCloudyContentAdmin()`. Core Auth verifies the access token before privileged data access.
- Leave `CLOUDY_CONTENT_SUPABASE_URL` and `CLOUDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY` unset so the Content helper uses the Core project fallback.

This is supported by the current server helper and by Core migrations `0016–0018`, which reference Shorts tables in the same `public` schema. Content migration `0009_shorts_follows.sql` also references `auth.users`, which conflicts with the old separate-project description of opaque user UUIDs. A separate Content project remains a future architecture option, not part of this initial migration.

## Include and exclude

### Core
Include every Core migration `0000–0020`. Core `0014` creates community/privacy objects; Core `0016–0018` add Shorts RPCs; Core `0019` creates chat history; Core `0020` hardens privacy-center writes.

### Content
- Exclude `0001_cloudy_content_core.sql`. It is the legacy separate-Content community schema and duplicates community objects already created by Core `0014`; its grants/revokes could change access to those Core tables.
- Include Content `0002–0010` for Shorts tables, RPCs, Storage, media-analysis metadata, follows, saved posts and comment interactions.
- Resolve the duplicate `0009` filename before creating the canonical migration history. Proposed logical order: follows, saved posts, comment interactions.

## Proposed dependency order

This is a plan to test on a disposable empty Supabase database, not authorization to apply SQL to the connected destination.

1. Core migrations `0000–0015`, in numeric order.
2. Content `0002_shorts_and_ai_moderation.sql`.
3. Content `0003_shorts_text_moderation_rpc.sql`.
4. Content `0004_shorts_private_storage.sql`.
5. Content `0005_shorts_frame_analysis.sql`.
6. Content `0006_shorts_audio_analysis.sql`.
7. Content `0007_shorts_human_moderation.sql`.
8. Content `0008_shorts_photo_text_posts.sql`.
9. Content `0009_shorts_follows.sql`.
10. Content `0009_shorts_saved_posts.sql` (give it a unique version in the canonical history).
11. Content `0010_shorts_comment_interactions.sql` (give it a unique version in the canonical history).
12. Content `0011_shorts_saved_posts_security.sql` (new additive hardening migration).
13. Core `0016_shorts_publication_and_post_publish_review.sql`.
14. Core `0017_shorts_caption_nonblocking.sql`.
15. Core `0018_shorts_feed_and_review_rpc.sql`.
16. Core `0019_cloudy_chat_history.sql`.
17. Core `0020_secure_privacy_center_writes.sql`.

The hardening migration is now present in the migration branch. It runs after the saved-posts table exists and before the application is enabled.

## Migration runner gap

The repository does not currently have a verified command that applies both SQL tracks:
- `drizzle.config.ts` points only to `./drizzle/migrations`.
- Content SQL is not wired into Drizzle Kit.
- The inspected `package.json` has no database migration script.
- There is no established Supabase CLI history for these existing files.

Create one canonical, ordered history under the standard `supabase/migrations/` directory. Supabase CLI migration files must be generated with `supabase migration new <name>`; do not invent timestamp filenames manually. Preserve original SQL sources or add an explicit source-to-canonical mapping. Avoid two active histories that can drift.

The canonical runner must apply all migrations in timestamp order, stop on the first SQL error, and track the exact migration version. It must support a disposable local/test database before any remote apply.

## Concrete security blocker

Content `0009_shorts_saved_posts.sql` creates `public.shorts_saved_posts` but does not enable RLS or explicitly revoke browser-role privileges. This differs from `shorts_follows` and `shorts_comment_likes`, which enable RLS and revoke access from browser roles.

Apply `0011_shorts_saved_posts_security.sql` and verify on a fresh Supabase database:
- `relrowsecurity` is enabled for `shorts_saved_posts`;
- `anon` and `authenticated` have no table privileges;
- `service_role` has only the privileges required by the server's select/upsert/delete operations.

Do not assume the table is protected just because the current server code uses an admin client.

## RPC behavior conflict requiring regression tests

Content `0008_shorts_photo_text_posts.sql` defines `apply_shorts_text_moderation` for comments and video/text posts. Core `0017_shorts_caption_nonblocking.sql` later replaces it with a comments-focused implementation that returns false for `short_video`.

The current `moderateOwnShortContent` server function is a no-op that returns an allow decision with `moderationApplied: false`; do not assume the RPC is used for text-only posts. Verify and test:
- text-only post creation and publication;
- comment allow/reject/review transitions;
- video caption moderation never approving underlying video media;
- photo publication through `finalize_shorts_nonvideo_publication`.

Core `0018` contains the final `finalize_shorts_publication` and `moderate_shorts_video` definitions, replacing earlier versions from Core `0016` and Content `0007`.

## Disposable database verification

- Apply the complete canonical history to a clean disposable Supabase database.
- Confirm all expected tables, columns, constraints, indexes, triggers, functions and Storage bucket exist.
- Confirm RLS is enabled on every exposed table.
- Verify `anon`, `authenticated` and `service_role` effective grants, including the saved-posts hardening.
- Inspect every `SECURITY DEFINER` function for fixed safe `search_path`, validated inputs and least-privilege execution grants.
- Confirm the `cloudy-shorts` bucket is private, has the expected MIME/size limits and no broad browser-role policies.
- Test Core Auth verification before privileged Shorts operations.
- Test upload, signed upload, signed playback, deletion, comments, likes, follows, saved posts, text/image/video publication and moderator review.
- Run application build, typecheck and tests against the resulting schema.

## Stop conditions

Do not apply the sequence to the connected destination until:
1. all Core and Content SQL files have been reviewed in full;
2. duplicate migration numbering and canonical runner semantics are resolved;
3. the exact sequence passes on a disposable Supabase environment;
4. RPC, RLS, grants and Storage checks pass;
5. application build, typecheck and tests pass against that schema.

No SQL migrations or data imports have been applied by this proposal. It does not authorize production cutover, deletion, changes to `main`, or changes to the existing Lovable database.
