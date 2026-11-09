-- Persistent replies and likes for Cloudy Shorts comments.
ALTER TABLE public.shorts_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid
  REFERENCES public.shorts_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS shorts_comments_parent_idx
  ON public.shorts_comments (video_id, parent_comment_id, created_at ASC)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.shorts_comment_likes (
  comment_id uuid NOT NULL REFERENCES public.shorts_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS shorts_comment_likes_user_idx
  ON public.shorts_comment_likes (user_id, created_at DESC);

ALTER TABLE public.shorts_comment_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shorts_comment_likes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.shorts_comment_likes TO service_role;
