-- Shorts publishing and AI moderation records for Cloudy Content.
-- Apply after 0001 in the Content database only.

CREATE TABLE IF NOT EXISTS public.shorts_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  storage_path text NOT NULL,
  caption text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'hidden', 'removed')),
  moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'needs_human_review')),
  moderation_reason text NOT NULL DEFAULT '',
  moderation_labels jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(moderation_labels) = 'array'),
  moderated_at timestamptz,
  published_at timestamptz,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shorts_videos_caption_length CHECK (char_length(caption) <= 500),
  CONSTRAINT shorts_videos_storage_path_length CHECK (char_length(storage_path) BETWEEN 1 AND 500)
);
CREATE INDEX IF NOT EXISTS shorts_videos_feed_idx
  ON public.shorts_videos (published_at DESC) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS shorts_videos_author_idx
  ON public.shorts_videos (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shorts_videos_review_queue_idx
  ON public.shorts_videos (created_at ASC) WHERE moderation_status IN ('pending', 'needs_human_review');

CREATE TABLE IF NOT EXISTS public.shorts_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.shorts_videos(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'published', 'hidden', 'removed')),
  moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'needs_human_review')),
  moderation_reason text NOT NULL DEFAULT '',
  moderation_labels jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(moderation_labels) = 'array'),
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shorts_comments_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000)
);
CREATE INDEX IF NOT EXISTS shorts_comments_video_idx
  ON public.shorts_comments (video_id, created_at ASC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS shorts_comments_review_queue_idx
  ON public.shorts_comments (created_at ASC) WHERE moderation_status IN ('pending', 'needs_human_review');

CREATE TABLE IF NOT EXISTS public.shorts_likes (
  video_id uuid NOT NULL REFERENCES public.shorts_videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);
CREATE INDEX IF NOT EXISTS shorts_likes_user_idx ON public.shorts_likes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.content_user_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restriction_type text NOT NULL CHECK (restriction_type IN ('comment_block', 'upload_block', 'community_block', 'temporary_ban', 'permanent_ban')),
  reason text NOT NULL,
  source text NOT NULL CHECK (source IN ('ai', 'admin', 'system')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT content_user_restrictions_reason_length CHECK (char_length(reason) BETWEEN 1 AND 1000),
  CONSTRAINT content_user_restrictions_expiry CHECK (expires_at IS NULL OR expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS content_user_restrictions_active_idx
  ON public.content_user_restrictions (user_id, starts_at DESC) WHERE active = true;

CREATE TABLE IF NOT EXISTS public.content_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('short_video', 'short_comment', 'community_post', 'community_comment', 'user')),
  content_id uuid,
  user_id uuid,
  actor_type text NOT NULL CHECK (actor_type IN ('cloudy_ai', 'admin', 'system')),
  action text NOT NULL CHECK (action IN ('approve', 'reject', 'hide', 'remove', 'restore', 'warn', 'restrict', 'ban', 'unban', 'escalate')),
  reason text NOT NULL DEFAULT '',
  labels jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(labels) = 'array'),
  confidence numeric(4,3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  model text NOT NULL DEFAULT '',
  policy_version text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_moderation_events_reason_length CHECK (char_length(reason) <= 2000)
);
CREATE INDEX IF NOT EXISTS content_moderation_events_content_idx
  ON public.content_moderation_events (content_type, content_id, created_at DESC);
CREATE INDEX IF NOT EXISTS content_moderation_events_user_idx
  ON public.content_moderation_events (user_id, created_at DESC);

ALTER TABLE public.shorts_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shorts_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shorts_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_user_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_moderation_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.shorts_videos, public.shorts_comments, public.shorts_likes,
  public.content_user_restrictions, public.content_moderation_events
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.shorts_videos, public.shorts_comments, public.shorts_likes,
  public.content_user_restrictions, public.content_moderation_events TO service_role;
