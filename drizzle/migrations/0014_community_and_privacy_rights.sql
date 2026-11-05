-- Cloudy community foundation and privacy-rights request tracking.
-- Public visibility is opt-in. Private email, age, and learning data are never exposed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_length_check CHECK (char_length(bio) <= 240);

CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_posts_body_length_check CHECK (
    char_length(btrim(body)) BETWEEN 1 AND 2000
  )
);
CREATE INDEX IF NOT EXISTS community_posts_published_created_idx
  ON public.community_posts (created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS community_posts_author_created_idx
  ON public.community_posts (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'hidden', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_comments_body_length_check CHECK (
    char_length(btrim(body)) BETWEEN 1 AND 1000
  )
);
CREATE INDEX IF NOT EXISTS community_comments_post_created_idx
  ON public.community_comments (post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.community_reactions (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL DEFAULT 'like' CHECK (reaction IN ('like', 'support', 'helpful')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('harassment', 'personal_data', 'spam', 'inappropriate', 'other')),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_reports_one_target CHECK (
    (post_id IS NOT NULL)::int + (comment_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT community_reports_details_length_check CHECK (char_length(details) <= 1000)
);
CREATE INDEX IF NOT EXISTS community_reports_status_created_idx
  ON public.community_reports (status, created_at ASC);

-- Support-assisted privacy requests: access/export, correction, deletion, and consent withdrawal.
CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('access_export', 'correction', 'deletion', 'withdraw_optional_consent')),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'verifying', 'in_progress', 'completed', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT privacy_requests_details_length_check CHECK (char_length(details) <= 2000)
);
CREATE INDEX IF NOT EXISTS privacy_requests_user_created_idx
  ON public.privacy_requests (user_id, created_at DESC);

-- Record only explicit, versioned acceptance/withdrawal of optional purposes.
CREATE TABLE IF NOT EXISTS public.optional_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('ai_model_training')),
  action text NOT NULL CHECK (action IN ('granted', 'withdrawn')),
  document_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS optional_consent_events_user_purpose_created_idx
  ON public.optional_consent_events (user_id, purpose, created_at DESC);

-- Safe public projection: exposes no email, age, account metadata, or learning records.
CREATE OR REPLACE VIEW public.community_public_profiles
WITH (security_barrier = true) AS
  SELECT id, display_name, bio, created_at
  FROM public.profiles
  WHERE is_public = true;
REVOKE ALL ON public.community_public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.community_public_profiles TO authenticated;

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optional_consent_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_reactions TO authenticated;
GRANT SELECT, INSERT ON public.community_reports TO authenticated;
GRANT SELECT, INSERT ON public.privacy_requests TO authenticated;
GRANT SELECT, INSERT ON public.optional_consent_events TO authenticated;
GRANT ALL ON public.community_posts, public.community_comments, public.community_reactions,
  public.community_reports, public.privacy_requests, public.optional_consent_events TO service_role;

-- A published post is visible only when its author has opted into public visibility.
CREATE POLICY community_posts_public_read ON public.community_posts
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = author_id AND p.is_public = true
    )
  );
CREATE POLICY community_posts_owner_read ON public.community_posts
  FOR SELECT TO authenticated USING (author_id = auth.uid());
CREATE POLICY community_posts_owner_insert ON public.community_posts
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_public = true
  ));
CREATE POLICY community_posts_owner_update ON public.community_posts
  FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY community_posts_owner_delete ON public.community_posts
  FOR DELETE TO authenticated USING (author_id = auth.uid());

CREATE POLICY community_comments_public_read ON public.community_comments
  FOR SELECT TO authenticated USING (
    status = 'published' AND EXISTS (
      SELECT 1 FROM public.community_posts cp
      JOIN public.community_public_profiles p ON p.id = cp.author_id
      WHERE cp.id = post_id AND cp.status = 'published' AND p.is_public = true
    )
  );
CREATE POLICY community_comments_owner_read ON public.community_comments
  FOR SELECT TO authenticated USING (author_id = auth.uid());
CREATE POLICY community_comments_owner_insert ON public.community_comments
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.community_posts cp
      JOIN public.profiles p ON p.id = cp.author_id
      WHERE cp.id = post_id AND cp.status = 'published' AND p.is_public = true
    )
  );
CREATE POLICY community_comments_owner_update ON public.community_comments
  FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY community_comments_owner_delete ON public.community_comments
  FOR DELETE TO authenticated USING (author_id = auth.uid());

CREATE POLICY community_reactions_public_read ON public.community_reactions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.community_posts cp
    JOIN public.profiles p ON p.id = cp.author_id
    WHERE cp.id = post_id AND cp.status = 'published' AND p.is_public = true
  ));
CREATE POLICY community_reactions_owner_insert ON public.community_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.community_posts cp
    JOIN public.profiles p ON p.id = cp.author_id
    WHERE cp.id = post_id AND cp.status = 'published' AND p.is_public = true
  ));
CREATE POLICY community_reactions_owner_delete ON public.community_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Reports and privacy requests are private to their author; service role handles moderation/support.
CREATE POLICY community_reports_owner_read ON public.community_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());
CREATE POLICY community_reports_owner_insert ON public.community_reports
  FOR INSERT TO authenticated WITH CHECK (
    reporter_id = auth.uid()
    AND ((post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.community_posts cp
      WHERE cp.id = post_id AND cp.status = 'published'
    )) OR (comment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.community_comments cc
      WHERE cc.id = comment_id AND cc.status = 'published'
    )))
  );
CREATE POLICY privacy_requests_owner_read ON public.privacy_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY privacy_requests_owner_insert ON public.privacy_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY optional_consent_owner_read ON public.optional_consent_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY optional_consent_owner_insert ON public.optional_consent_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Public profile fields are deliberately restricted to display_name and bio.
-- Do not grant broad profile-table reads: existing own-profile RLS remains intact.

-- Persist rate-limit windows independently of post deletion so deleting/reposting cannot bypass the cap.
CREATE TABLE IF NOT EXISTS public.community_post_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  post_count integer NOT NULL DEFAULT 0 CHECK (post_count >= 0)
);
ALTER TABLE public.community_post_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_post_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.community_post_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_community_post_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_window timestamptz := date_trunc('hour', now());
  current_count integer;
BEGIN
  INSERT INTO public.community_post_rate_limits (user_id, window_started_at, post_count)
  VALUES (NEW.author_id, current_window, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET window_started_at = CASE
        WHEN community_post_rate_limits.window_started_at < current_window THEN current_window
        ELSE community_post_rate_limits.window_started_at
      END,
      post_count = CASE
        WHEN community_post_rate_limits.window_started_at < current_window THEN 1
        ELSE community_post_rate_limits.post_count + 1
      END
  RETURNING post_count INTO current_count;

  IF current_count > 5 THEN
    RAISE EXCEPTION 'Достигнут лимит: не более 5 публикаций в час.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_community_post_rate_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS community_posts_rate_limit ON public.community_posts;
CREATE TRIGGER community_posts_rate_limit
  BEFORE INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_community_post_rate_limit();
