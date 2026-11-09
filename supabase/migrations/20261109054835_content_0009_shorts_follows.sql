-- Real creator follow relationships for Cloudy Shorts.
CREATE TABLE IF NOT EXISTS public.shorts_follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shorts_follows_pk PRIMARY KEY (follower_id, following_id),
  CONSTRAINT shorts_follows_no_self CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS shorts_follows_following_idx
  ON public.shorts_follows (following_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shorts_follows_follower_idx
  ON public.shorts_follows (follower_id, created_at DESC);
ALTER TABLE public.shorts_follows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shorts_follows FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.shorts_follows TO service_role;
