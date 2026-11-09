# Cloudy Content database

## Purpose

Shorts tables and private video storage currently live in the existing Cloudy Core Supabase project so uploads work without provisioning a second Supabase project. Community tables already existed in Core. The dedicated Content project remains an optional future separation; when configured, the server prefers it. Cloudy AI and its provider secrets remain in Core.

## Ownership boundaries

### Core (existing project)
- Supabase Auth, accounts, sessions, profiles and account metadata.
- User progress, XP, lesson completion, learner profile and learning event journal.
- AI provider secrets and AI configuration (including the existing AI Vault).
- Privacy requests and optional-consent records.
- Public-profile opt-in and canonical display name/bio.

### Content data (currently co-located in Core)
- Existing community posts, comments, reactions, reports and rate limits.
- Shorts video metadata, comments and likes.
- AI moderation decisions, review queues, moderation events and user restrictions.
- Private `cloudy-shorts` Storage bucket.

The static lesson curriculum stays in application code for now. Do not move it into Content until there is a concrete content-authoring/versioning requirement.

## Authentication and trust boundary

Core Auth is the only identity provider. Content does not create a second auth system and intentionally has no foreign keys to auth.users. The stable Core user UUID is stored as an opaque author_id/user_id/reporter_id/reviewed_by reference.

All Content database calls must be server-side. The server validates the caller's Core access token with Core Supabase Auth (auth.getUser(token)), derives the user ID from that verified user, and only then accesses Content. Never trust a client-supplied user ID. Never expose a Content service-role key or privileged Content client to the browser.

## Cloudy AI moderation

Cloudy AI remains in Core. The existing AI provider configuration and encrypted/provider-key vault stay in Core and are never copied into Content. A trusted server moderation service loads enabled providers from the Core AI Vault, calls the existing AI routing/provider layer, and passes only the minimum required content context. It writes the moderation decision, labels, reason, confidence, model and policy version to Content.

The first server moderation endpoint reviews an author's pending Shorts text using enabled providers from the Core AI Vault and writes the result atomically through a service-role-only Content RPC. Comments can be published only after a high-confidence allow decision; clear violations are removed; ambiguous cases remain pending for review. Video captions can be rejected, but even an allowed caption leaves the video in `needs_human_review`: actual video-frame and audio inspection is not implemented yet, so the video itself cannot be approved or published.

Use a staged policy: clear allowed content can be approved; clear violations are rejected/hidden; uncertain or high-impact cases go to human review. Automatic account restrictions must be proportionate, reasoned, time-bounded where possible, recorded in an audit event, and reversible by an authorized moderator. Do not permanently ban solely on a low-confidence model result.

Public feed eligibility is checked against Core profiles.is_public. Resolve display names and bios from Core's safe profile projection; do not copy private profile data into Content.

## Provisioning — current single-project deployment

The current migration target is one Supabase project. Core and Shorts/Content tables are co-located in the same project. The dedicated Content project remains a possible future separation, but it is not required for the current Vercel migration.

1. Configure the normal Core server variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY`.
2. Leave `CLOUDY_CONTENT_SUPABASE_URL` and `CLOUDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY` unset so `getCloudyContentAdmin()` uses the Core project fallback.
3. Apply Core migrations through `0015`, then apply Content migrations `0002`–`0010` (with the duplicate `0009` prefix resolved), then apply Core Shorts RPC migrations `0016`–`0018`. Use the detailed ordered plan in `docs/migration/SUPABASE_MIGRATION_SEQUENCE.md`.
4. Do **not** apply `0001_cloudy_content_core.sql` to this project: Core migration `0014` already creates the community schema. Applying the legacy Content community migration can duplicate objects and alter grants.
5. The private `cloudy-shorts` bucket is created by Content migration `0004` (100 MB maximum; MP4, WebM and QuickTime; later migration `0008` adds image MIME types). The server verifies Core Auth and upload restrictions, creates a draft row, and returns a signed upload capability. The browser uploads only with the scoped signed token; the server verifies the stored object before finalization. This upload-finalize step does not itself approve video media.

## Migration and rollout

- For the current single-project migration, community and Shorts remain in the same destination Supabase project; there is no cross-project data switch.
- Preserve user UUIDs, post/comment/reaction/report UUIDs, timestamps, moderation states and rate-limit data when importing existing records.
- Existing AI provider records and AI configuration remain in Core and must be migrated securely; never export provider keys as plaintext into logs or source control.
- Verify row counts, relationships and sample records before enabling the new deployment.
- Keep the old Lovable/Core database intact during validation and rollback; do not drop or mutate its tables during initial cutover.
- Privacy requests and optional-consent events stay in Core.

## Security

- Content RLS is enabled with no policies for browser roles; only service_role can access data.
- The server enforces ownership, public visibility, input limits and rate limits before writes.
- AI moderation is invoked server-side using Core AI Vault credentials; Content stores decisions, not provider secrets. The server uses conservative confidence thresholds and fails closed to human review when the AI is unavailable or returns invalid output.
- A video is not considered fully AI-moderated until media frames/audio are actually inspected; caption-only moderation cannot approve the underlying video.
- Moderation RPC is callable only with service role and only after the Core admin check.
- Service-role credentials must never be committed to the repository.

## Shorts comment request flow

1. The embedded Shorts UI sends a comment request through the same-origin Cloudy auth bridge; the bridge attaches the current Core access token and never accepts a client-supplied author ID.
2. The server validates the Core token, confirms that the target video is approved, and checks active Content restrictions for the authenticated user.
3. The server inserts the comment as `pending_review`, then asks Cloudy AI through the existing Core AI Vault/provider router to review the text.
4. A high-confidence allow decision publishes the comment. A clear high-confidence violation removes it. Uncertain results or AI outages leave it pending for additional review.
5. Public comment reads return only rows with `status = 'published'`; pending or rejected text is never returned in the public thread.

The current three Shorts cards are clearly marked demonstration content with non-database IDs and show no fabricated comments or comment counts. Live comment calls activate only for real UUID-backed Content videos after the Content project and migrations are provisioned. Replies, comment likes, and actual video upload/feed playback are not part of this slice.


## Shorts upload and moderation flow

1. The embedded UI sends file metadata and caption through the same-origin auth bridge; the bridge attaches the current Core access token.
2. The server validates the Core user, checks active upload/community restrictions, creates a private draft row and returns a short-lived signed upload URL. The service-role key stays server-side.
3. The browser uploads the original file directly to the private Storage bucket using the signed URL and the Content project's publishable key.
4. The server verifies ownership and object existence, then moves the upload to \`pending_review\`. It never publishes at finalize time.
5. Cloudy AI checks the caption. A high-confidence rejection keeps the video unavailable; a successful caption check only advances the video to media review.
6. The app server creates a five-minute signed URL for the stored original and calls the isolated FFmpeg container using a server-only bearer token. The browser no longer extracts or supplies frame/audio samples.
7. The container validates the signed private-storage URL and extracts up to six frames or up to nine mono 16 kHz WAV chunks. It limits file size, duration, concurrency and output size, and deletes temporary files after each request.
8. The app server sends frames to a vision-capable provider and audio chunks to Groq/OpenAI transcription from the Core AI Vault. It runs the transcript through the Cloudy AI content policy. The transcript itself is neither returned to the browser nor stored.
9. The AI results are triage only. They are recorded with labels, confidence, model and audit events; they do not auto-publish, auto-reject the whole video, or restrict the author.
10. A Core-authenticated administrator opens the private Shorts moderation queue, watches the original video and explicitly approves or rejects it. The Content DB RPC atomically updates the publication state and writes the human moderation event.

## Shorts human moderation queue

- The existing owner/admin panel exposes a private review queue with five-minute signed preview URLs. The Storage bucket remains private.
- Queue entries show author display name, caption, text-moderation outcome, frame triage and audio triage metadata. A moderator must inspect the complete original before deciding.
- Only a Core-authenticated administrator can list the queue or approve/reject a video. Approving publishes it; rejecting keeps it unavailable.
- AI labels are evidence for review, not a verdict about the author. This panel does not automatically ban accounts.
- Apply Content DB migration \`0007_shorts_human_moderation.sql\` after \`0001\`–\`0006\`.

## Trusted media processor deployment

- The app runs on Cloudflare Workers, which cannot spawn a system FFmpeg process. The separate container source is in \`services/cloudy-shorts-media\`.
- Deploy that Docker image to a private HTTPS-capable container host. Set \`CLOUDY_CONTENT_SUPABASE_URL\` and a random \`CLOUDY_MEDIA_PROCESSOR_TOKEN\` in the container.
- Set \`CLOUDY_MEDIA_PROCESSOR_URL\` and the same \`CLOUDY_MEDIA_PROCESSOR_TOKEN\` as server-only Cloudy application environment variables. Do not expose the token to the browser or commit it.
- The processor does not need the Content service-role key; it receives only a five-minute signed URL for the exact video.
- Until the container is deployed and the server environment variables exist, media analysis safely reports unavailable and videos stay private in the human review queue.
- The Content DB project must also be provisioned and migrations \`0001\`–\`0007\` applied in order. The repository contains these migrations, but merging code does not apply SQL to the remote database.
