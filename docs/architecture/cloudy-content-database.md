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

All Content database calls must be server-side. The server validates the caller's Core access token with Core Supabase Auth (auth.getUser(token)), derives the user ID from that verified user, and only then accesses Content. Never trust a client-supplied user ID. Never expose a Content service-role key or privileged Content client to the browser.

## Cloudy AI moderation

Cloudy AI remains in Core. The existing AI provider configuration and encrypted/provider-key vault stay in Core and are never copied into Content. A trusted server moderation service loads enabled providers from the Core AI Vault, calls the existing AI routing/provider layer, and passes only the minimum required content context. It writes the moderation decision, labels, reason, confidence, model and policy version to Content.

The first server moderation endpoint reviews an author's pending Shorts text using enabled providers from the Core AI Vault and writes the result atomically through a service-role-only Content RPC. Comments can be published only after a high-confidence allow decision; clear violations are removed; ambiguous cases remain pending for review. Video captions can be rejected, but even an allowed caption leaves the video in `needs_human_review`: actual video-frame and audio inspection is not implemented yet, so the video itself cannot be approved or published.

Use a staged policy: clear allowed content can be approved; clear violations are rejected/hidden; uncertain or high-impact cases go to human review. Automatic account restrictions must be proportionate, reasoned, time-bounded where possible, recorded in an audit event, and reversible by an authorized moderator. Do not permanently ban solely on a low-confidence model result.

Public feed eligibility is checked against Core profiles.is_public. Resolve display names and bios from Core's safe profile projection; do not copy private profile data into Content.

## Provisioning

1. Create a separate Supabase project for Cloudy Content.
2. Apply drizzle/migrations-content/0001_cloudy_content_core.sql, 0002_shorts_and_ai_moderation.sql and 0003_shorts_text_moderation_rpc.sql and 0004_shorts_private_storage.sql to the Content database only.
3. Configure server-only CLOUDY_CONTENT_SUPABASE_URL and CLOUDY_CONTENT_SUPABASE_SERVICE_ROLE_KEY. Also configure CLOUDY_CONTENT_SUPABASE_PUBLISHABLE_KEY (the public, non-secret project key) for the signed-upload browser request; it is never a service-role credential.
4. Do not change existing SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY or SUPABASE_SERVICE_ROLE_KEY; those continue to point to Core.
5. Migration 0004 creates the private cloudy-shorts bucket (100 MB maximum; MP4, WebM and QuickTime). The server verifies Core Auth and upload restrictions, creates a draft row, and returns a two-hour signed upload capability. The embedded UI uploads the file directly to that signed URL and calls the server to verify the stored object; finalization moves it only to pending_review. This does not approve or publish media.

## Migration and rollout

- Keep existing community tables in Core until Content is provisioned, migrated and verified.
- Export/import existing posts, comments, reactions and reports with original UUIDs and timestamps; preserve moderation statuses and rate-limit counters where possible.
- Existing AI provider records and AI configuration remain in Core and are not migrated.
- Verify row counts and sample records before switching reads/writes.
- Switch server endpoints to Content behind an explicit server configuration/feature flag.
- Keep a rollback window; do not drop Core community tables during initial cutover.
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


## Shorts video upload request flow

1. The embedded UI sends file metadata and caption through the same-origin auth bridge; the bridge attaches the current Core access token.
2. The server validates the Core user, checks active upload/community restrictions, creates a private draft row and returns a short-lived signed upload URL. The service-role key stays server-side.
3. The browser uploads the file directly to the private Storage bucket using the signed URL and the Content project's public publishable key.
4. The UI asks the server to finalize. The server verifies ownership and confirms the object exists and is within the size limit, then sets the row to pending_review.
5. No video is added to the public feed at this stage. Frame/audio inspection and a human-review workflow must be implemented before any video can be approved.


## Shorts frame triage (initial media-review slice)

- After upload and caption moderation, the browser samples up to six JPEG frames from the selected local video and sends them through the authenticated same-origin bridge.
- The server verifies the Core account, video ownership and pending-review state, then sends only those sampled images to an enabled vision-capable provider from the Core AI Vault.
- The result and labels are stored in the Content database with an audit event. If frame extraction or vision is unavailable, the row records an unavailable state for manual review.
- Important trust boundary: browser-sampled frames are client-provided and are not a cryptographically verified decode of the stored object. This is triage only; the AI result cannot approve, reject, publish the video or restrict its author. Every video remains private and requires human review.
- Audio/transcription and server-side decoding of the original uploaded file are not implemented in this slice. Do not describe this as complete video moderation or audio moderation.


## Shorts audio transcription and moderation (initial client-extracted slice)

- After the frame triage, the browser decodes the selected local video, downmixes its first audio channel to mono 16 kHz PCM WAV, and sends up to nine 20-second chunks to the authenticated server bridge. This supports videos up to three minutes and 35 MB; unsupported codecs, larger files, or longer videos fail closed into manual review.
- The server verifies Core identity, video ownership and pending-review state. It uses an enabled Groq or OpenAI provider stored in the Core AI Vault to transcribe chunks, then runs the transcript through the existing Cloudy AI content policy.
- Transcript text is transient: it is neither returned to the browser nor persisted in Content DB. Only status, labels, decision, confidence, model and audit metadata are stored.
- Audio results are triage only. They cannot approve, reject, publish a video or restrict its author. All videos remain private and require human review.
- Audio extraction still happens in the browser and depends on codec support. This is not server-verified decoding of the stored original. A failed/unavailable transcription always stays in the manual-review path.


## Human moderation queue for Shorts

- The existing owner/admin panel exposes a private Shorts review queue. It creates five-minute signed preview URLs server-side; the Content Storage bucket remains private.
- Queue entries include author display name, caption, text-moderation outcome, frame triage and audio triage metadata. A moderator must inspect the full video before making a decision.
- Only a Core-authenticated administrator can list the queue or approve/reject a video. The Content DB RPC applies the decision atomically and writes a moderation event. Approving publishes the video; rejecting keeps it unavailable.
- This is the human decision layer, not an automatic AI ban system. AI labels are evidence for review, not a verdict about the author. The moderation panel does not automatically ban accounts.
- Apply Content DB migration \`0007_shorts_human_moderation.sql\` after \`0001\`–\`0006\`.
- The app is deployed on Cloudflare Workers. Its request runtime does not provide a general-purpose FFmpeg binary/process API; therefore server-side decoding of the original video cannot be honestly claimed or added as a normal Node subprocess. Current frame/audio samples remain client-extracted and untrusted. A trusted server media pipeline requires a separately deployed media-processing service (for example, a dedicated container/worker with FFmpeg) and a private service binding; until then, human review of the full private original is mandatory.
