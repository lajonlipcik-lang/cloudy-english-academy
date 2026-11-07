-- Persist each user's saved Shorts independently of browser/device storage.
CREATE TABLE IF NOT EXISTS public.shorts_saved_posts (
  video_id uuid NOT NULL REFERENCES public.shorts_videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);
CREATE INDEX IF NOT EXISTS shorts_saved_posts_user_idx
  ON public.shorts_saved_posts (user_id, created_at DESC);
