-- Append-only, account-scoped journal for Cloudy learning activity.
CREATE TABLE IF NOT EXISTS public.cloudy_learning_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  session_id uuid,
  event_type text NOT NULL CHECK (event_type IN (
    'session_started', 'answer_submitted', 'question_skipped', 'hint_used',
    'lesson_completed', 'lesson_failed', 'lesson_abandoned'
  )),
  occurred_at timestamptz NOT NULL,
  level text CHECK (level IS NULL OR level IN ('A1', 'A2', 'B1', 'B2')),
  lesson_index integer CHECK (lesson_index IS NULL OR lesson_index BETWEEN -1 AND 1000),
  session_type text CHECK (session_type IS NULL OR session_type IN ('lesson', 'review')),
  exercise_type text CHECK (exercise_type IS NULL OR length(exercise_type) <= 24),
  skill_id text CHECK (skill_id IS NULL OR length(skill_id) <= 90),
  is_correct boolean,
  retry boolean NOT NULL DEFAULT false,
  response_seconds integer CHECK (response_seconds IS NULL OR response_seconds BETWEEN 0 AND 3600),
  selected_answer text CHECK (selected_answer IS NULL OR length(selected_answer) <= 160),
  correct_answer text CHECK (correct_answer IS NULL OR length(correct_answer) <= 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cloudy_learning_events_user_event_unique UNIQUE (user_id, event_id),
  CONSTRAINT cloudy_learning_events_answer_outcome_check CHECK (event_type <> 'answer_submitted' OR is_correct IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS cloudy_learning_events_user_time_idx
  ON public.cloudy_learning_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS cloudy_learning_events_session_idx
  ON public.cloudy_learning_events (user_id, session_id, occurred_at);

ALTER TABLE public.cloudy_learning_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own Cloudy learning events" ON public.cloudy_learning_events;
CREATE POLICY "Users can read their own Cloudy learning events"
  ON public.cloudy_learning_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.cloudy_learning_events FROM anon, authenticated;
GRANT SELECT ON public.cloudy_learning_events TO authenticated;
GRANT ALL ON public.cloudy_learning_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cloudy_learning_events_id_seq TO service_role;
