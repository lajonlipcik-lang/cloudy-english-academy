CREATE TABLE IF NOT EXISTS public.cloudy_chat_threads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id text NOT NULL CHECK (char_length(thread_id) BETWEEN 1 AND 80),
  title text NOT NULL DEFAULT 'Новый диалог' CHECK (char_length(title) <= 120),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(messages) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_id)
);

CREATE INDEX IF NOT EXISTS cloudy_chat_threads_user_updated_idx
  ON public.cloudy_chat_threads (user_id, updated_at DESC);

ALTER TABLE public.cloudy_chat_threads ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloudy_chat_threads TO authenticated;
GRANT ALL ON public.cloudy_chat_threads TO service_role;

DROP POLICY IF EXISTS "Users can read own chat threads" ON public.cloudy_chat_threads;
CREATE POLICY "Users can read own chat threads"
  ON public.cloudy_chat_threads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat threads" ON public.cloudy_chat_threads;
CREATE POLICY "Users can insert own chat threads"
  ON public.cloudy_chat_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat threads" ON public.cloudy_chat_threads;
CREATE POLICY "Users can update own chat threads"
  ON public.cloudy_chat_threads FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat threads" ON public.cloudy_chat_threads;
CREATE POLICY "Users can delete own chat threads"
  ON public.cloudy_chat_threads FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
