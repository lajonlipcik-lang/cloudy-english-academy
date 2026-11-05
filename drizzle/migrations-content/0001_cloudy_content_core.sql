-- Cloudy Content database: community data only.
-- Apply ONLY to the new Supabase project, never to the existing Core project.
-- Core Auth remains the identity provider; UUIDs here are opaque references.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_posts_body_length_check CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000)
);
CREATE INDEX IF NOT EXISTS community_posts_feed_idx ON public.community_posts (created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS community_posts_author_idx ON public.community_posts (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_comments_body_length_check CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000)
);
CREATE INDEX IF NOT EXISTS community_comments_post_created_idx ON public.community_comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS community_comments_author_idx ON public.community_comments (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_reactions (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reaction text NOT NULL DEFAULT 'like' CHECK (reaction IN ('like', 'support', 'helpful')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS community_reactions_user_idx ON public.community_reactions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('harassment', 'personal_data', 'spam', 'inappropriate', 'other')),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  moderation_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_reports_one_target CHECK ((post_id IS NOT NULL)::int + (comment_id IS NOT NULL)::int = 1),
  CONSTRAINT community_reports_details_length_check CHECK (char_length(details) <= 1000),
  CONSTRAINT community_reports_moderation_note_length_check CHECK (char_length(moderation_note) <= 1000)
);
CREATE INDEX IF NOT EXISTS community_reports_status_created_idx ON public.community_reports (status, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS community_reports_one_post_per_user_idx ON public.community_reports (reporter_id, post_id) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS community_reports_one_comment_per_user_idx ON public.community_reports (reporter_id, comment_id) WHERE comment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.community_post_rate_limits (
  user_id uuid PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  post_count integer NOT NULL DEFAULT 0 CHECK (post_count >= 0)
);
CREATE TABLE IF NOT EXISTS public.community_comment_rate_limits (
  user_id uuid PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  comment_count integer NOT NULL DEFAULT 0 CHECK (comment_count >= 0)
);

CREATE OR REPLACE FUNCTION public.enforce_community_post_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_window timestamptz := date_trunc('hour', now()); current_count integer;
BEGIN
  INSERT INTO public.community_post_rate_limits (user_id, window_started_at, post_count)
  VALUES (NEW.author_id, current_window, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET window_started_at = CASE WHEN community_post_rate_limits.window_started_at < current_window THEN current_window ELSE community_post_rate_limits.window_started_at END,
      post_count = CASE WHEN community_post_rate_limits.window_started_at < current_window THEN 1 ELSE community_post_rate_limits.post_count + 1 END
  RETURNING post_count INTO current_count;
  IF current_count > 5 THEN RAISE EXCEPTION 'Достигнут лимит: не более 5 публикаций в час.'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_community_post_rate_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS community_posts_rate_limit ON public.community_posts;
CREATE TRIGGER community_posts_rate_limit BEFORE INSERT ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.enforce_community_post_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_community_comment_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE current_window timestamptz := date_trunc('hour', now()); current_count integer;
BEGIN
  INSERT INTO public.community_comment_rate_limits (user_id, window_started_at, comment_count)
  VALUES (NEW.author_id, current_window, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET window_started_at = CASE WHEN community_comment_rate_limits.window_started_at < current_window THEN current_window ELSE community_comment_rate_limits.window_started_at END,
      comment_count = CASE WHEN community_comment_rate_limits.window_started_at < current_window THEN 1 ELSE community_comment_rate_limits.comment_count + 1 END
  RETURNING comment_count INTO current_count;
  IF current_count > 10 THEN RAISE EXCEPTION 'Достигнут лимит: не более 10 комментариев в час.'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_community_comment_rate_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS community_comments_rate_limit ON public.community_comments;
CREATE TRIGGER community_comments_rate_limit BEFORE INSERT ON public.community_comments FOR EACH ROW EXECUTE FUNCTION public.enforce_community_comment_rate_limit();

CREATE OR REPLACE FUNCTION public.moderate_community_report(
  p_report_id uuid, p_status text, p_content_action text DEFAULT 'none',
  p_moderator_id uuid DEFAULT NULL, p_moderation_note text DEFAULT ''
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_post_id uuid; target_comment_id uuid;
BEGIN
  IF p_status NOT IN ('open', 'reviewing', 'resolved', 'dismissed') THEN RAISE EXCEPTION 'Invalid report status'; END IF;
  IF p_content_action NOT IN ('none', 'hide', 'restore') THEN RAISE EXCEPTION 'Invalid content action'; END IF;
  IF p_moderator_id IS NULL THEN RAISE EXCEPTION 'Moderator identity is required'; END IF;
  IF char_length(coalesce(p_moderation_note, '')) > 1000 THEN RAISE EXCEPTION 'Moderation note is too long'; END IF;
  SELECT post_id, comment_id INTO target_post_id, target_comment_id FROM public.community_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
  IF p_content_action = 'hide' THEN
    IF target_post_id IS NOT NULL THEN UPDATE public.community_posts SET status = 'hidden', updated_at = now() WHERE id = target_post_id;
    ELSE UPDATE public.community_comments SET status = 'hidden', updated_at = now() WHERE id = target_comment_id; END IF;
  ELSIF p_content_action = 'restore' THEN
    IF target_post_id IS NOT NULL THEN UPDATE public.community_posts SET status = 'published', updated_at = now() WHERE id = target_post_id;
    ELSE UPDATE public.community_comments SET status = 'published', updated_at = now() WHERE id = target_comment_id; END IF;
  END IF;
  UPDATE public.community_reports SET status = p_status, reviewed_by = p_moderator_id, reviewed_at = now(),
    moderation_note = btrim(coalesce(p_moderation_note, '')) WHERE id = p_report_id;
END $$;
REVOKE ALL ON FUNCTION public.moderate_community_report(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comment_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_posts, public.community_comments, public.community_reactions,
  public.community_reports, public.community_post_rate_limits, public.community_comment_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.community_posts, public.community_comments, public.community_reactions,
  public.community_reports, public.community_post_rate_limits, public.community_comment_rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION public.moderate_community_report(uuid, text, text, uuid, text) TO service_role;
