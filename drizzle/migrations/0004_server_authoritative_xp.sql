-- Server-owned XP ledger. Existing progress rows are migrated without losing earned XP.
CREATE TABLE IF NOT EXISTS public.user_progress_xp (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp integer NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  week_key text NOT NULL DEFAULT '',
  week_xp integer NOT NULL DEFAULT 0 CHECK (week_xp >= 0),
  daily_key date NOT NULL DEFAULT current_date,
  daily_lessons integer NOT NULL DEFAULT 0 CHECK (daily_lessons >= 0)
);

INSERT INTO public.user_progress_xp (user_id, total_xp, week_key, week_xp)
SELECT user_id, GREATEST(total_xp, 0), week_key, GREATEST(week_xp, 0)
FROM public.user_progress
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_progress_awards (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_index integer NOT NULL CHECK (lesson_index BETWEEN 0 AND 23),
  level text NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2')),
  award_day date NOT NULL DEFAULT current_date,
  xp_awarded integer NOT NULL DEFAULT 24 CHECK (xp_awarded = 24),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_index, award_day)
);

ALTER TABLE public.user_progress_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress_awards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_progress_xp FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.user_progress_awards FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.user_progress_xp TO service_role;
GRANT ALL ON public.user_progress_awards TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.user_progress_awards_id_seq TO service_role;

-- Authenticated clients may read their progress, but only trusted server code can write it.
DROP POLICY IF EXISTS "own progress insert" ON public.user_progress;
DROP POLICY IF EXISTS "own progress update" ON public.user_progress;

CREATE OR REPLACE FUNCTION public.save_cloudy_progress(_user_id uuid, _state jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp public.user_progress_xp%ROWTYPE;
  v_state jsonb;
BEGIN
  IF _user_id IS NULL OR jsonb_typeof(_state) <> 'object' THEN
    RAISE EXCEPTION 'Invalid progress payload';
  END IF;

  INSERT INTO public.user_progress_xp (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_xp
  FROM public.user_progress_xp
  WHERE user_id = _user_id
  FOR UPDATE;

  v_state := jsonb_set(COALESCE(_state, '{}'::jsonb), '{xp}', to_jsonb(v_xp.total_xp), true);
  v_state := jsonb_set(v_state, '{wk}', jsonb_build_object('k', v_xp.week_key, 'xp', v_xp.week_xp), true);

  INSERT INTO public.user_progress (user_id, state, total_xp, week_key, week_xp, updated_at)
  VALUES (_user_id, v_state, v_xp.total_xp, v_xp.week_key, v_xp.week_xp, now())
  ON CONFLICT (user_id) DO UPDATE
  SET state = EXCLUDED.state, total_xp = EXCLUDED.total_xp,
      week_key = EXCLUDED.week_key, week_xp = EXCLUDED.week_xp, updated_at = now();

  RETURN v_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_cloudy_lesson_xp(_user_id uuid, _lesson_index integer, _level text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp public.user_progress_xp%ROWTYPE;
  v_day date := current_date;
  v_year_start date := date_trunc('year', current_date)::date;
  v_week_key text;
  v_award integer := 24;
BEGIN
  IF _user_id IS NULL OR _level NOT IN ('A1', 'A2', 'B1', 'B2') OR _lesson_index NOT BETWEEN 0 AND 23 THEN
    RAISE EXCEPTION 'Invalid lesson completion';
  END IF;

  IF NOT (
    (_level = 'A1' AND _lesson_index BETWEEN 0 AND 5) OR
    (_level = 'A2' AND (_lesson_index BETWEEN 6 AND 8 OR _lesson_index BETWEEN 15 AND 17)) OR
    (_level = 'B1' AND (_lesson_index BETWEEN 9 AND 11 OR _lesson_index BETWEEN 18 AND 20)) OR
    (_level = 'B2' AND (_lesson_index BETWEEN 12 AND 14 OR _lesson_index BETWEEN 21 AND 23))
  ) THEN
    RAISE EXCEPTION 'Lesson does not belong to the selected level';
  END IF;

  v_week_key := extract(year FROM current_date)::int::text || 'w' ||
    floor(((current_date - v_year_start) + extract(dow FROM v_year_start)::int)::numeric / 7)::int::text;

  INSERT INTO public.user_progress_xp (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_xp
  FROM public.user_progress_xp
  WHERE user_id = _user_id
  FOR UPDATE;

  IF v_xp.daily_key <> v_day THEN
    UPDATE public.user_progress_xp SET daily_key = v_day, daily_lessons = 0
    WHERE user_id = _user_id;
    v_xp.daily_key := v_day;
    v_xp.daily_lessons := 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_progress_awards
    WHERE user_id = _user_id AND lesson_index = _lesson_index AND award_day = v_day
  ) THEN
    RETURN jsonb_build_object('awarded', 0, 'total_xp', v_xp.total_xp, 'week_key', v_xp.week_key, 'week_xp', v_xp.week_xp, 'daily_lessons', v_xp.daily_lessons);
  END IF;

  IF v_xp.daily_lessons >= 5 THEN
    RAISE EXCEPTION 'Daily lesson XP limit reached';
  END IF;

  INSERT INTO public.user_progress_awards (user_id, lesson_index, level, award_day, xp_awarded)
  VALUES (_user_id, _lesson_index, _level, v_day, v_award);

  IF v_xp.week_key <> v_week_key THEN
    v_xp.week_key := v_week_key;
    v_xp.week_xp := 0;
  END IF;
  v_xp.total_xp := v_xp.total_xp + v_award;
  v_xp.week_xp := v_xp.week_xp + v_award;
  v_xp.daily_lessons := v_xp.daily_lessons + 1;

  UPDATE public.user_progress_xp
  SET total_xp = v_xp.total_xp, week_key = v_xp.week_key, week_xp = v_xp.week_xp,
      daily_key = v_day, daily_lessons = v_xp.daily_lessons
  WHERE user_id = _user_id;

  INSERT INTO public.user_progress (user_id, state, total_xp, week_key, week_xp, updated_at)
  VALUES (_user_id, jsonb_build_object('xp', v_xp.total_xp, 'wk', jsonb_build_object('k', v_xp.week_key, 'xp', v_xp.week_xp)),
    v_xp.total_xp, v_xp.week_key, v_xp.week_xp, now())
  ON CONFLICT (user_id) DO UPDATE
  SET state = jsonb_set(jsonb_set(COALESCE(user_progress.state, '{}'::jsonb), '{xp}', to_jsonb(v_xp.total_xp), true),
    '{wk}', jsonb_build_object('k', v_xp.week_key, 'xp', v_xp.week_xp), true),
    total_xp = v_xp.total_xp, week_key = v_xp.week_key, week_xp = v_xp.week_xp, updated_at = now();

  RETURN jsonb_build_object('awarded', v_award, 'total_xp', v_xp.total_xp, 'week_key', v_xp.week_key, 'week_xp', v_xp.week_xp, 'daily_lessons', v_xp.daily_lessons);
END;
$$;

REVOKE ALL ON FUNCTION public.save_cloudy_progress(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_cloudy_lesson_xp(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cloudy_progress(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_cloudy_lesson_xp(uuid, integer, text) TO service_role;
