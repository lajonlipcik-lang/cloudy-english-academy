-- Extend the server-authoritative lesson XP ledger for the 15 new A1 lessons.
-- The table constraint must allow the new indices before the award function can insert them.
ALTER TABLE public.user_progress_awards
  DROP CONSTRAINT IF EXISTS user_progress_awards_lesson_index_check;
ALTER TABLE public.user_progress_awards
  ADD CONSTRAINT user_progress_awards_lesson_index_check
  CHECK (lesson_index BETWEEN 0 AND 38);

-- Keep the existing server-authoritative XP and updated_at behavior while extending A1.
-- Return the exact progress-row version after server-authoritative lesson XP writes.
-- This lets the browser continue optimistic sync without manufacturing a conflict.
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
  v_updated_at timestamptz;
BEGIN
  IF _user_id IS NULL OR _level NOT IN ('A1', 'A2', 'B1', 'B2') OR _lesson_index NOT BETWEEN 0 AND 38 THEN
    RAISE EXCEPTION 'Invalid lesson completion';
  END IF;

  IF NOT (
    (_level = 'A1' AND (_lesson_index BETWEEN 0 AND 5 OR _lesson_index BETWEEN 24 AND 38)) OR
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
    SELECT updated_at INTO v_updated_at
    FROM public.user_progress
    WHERE user_id = _user_id;
    RETURN jsonb_build_object(
      'awarded', 0, 'total_xp', v_xp.total_xp,
      'week_key', v_xp.week_key, 'week_xp', v_xp.week_xp,
      'daily_lessons', v_xp.daily_lessons, 'updated_at', v_updated_at
    );
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
    total_xp = v_xp.total_xp, week_key = v_xp.week_key, week_xp = v_xp.week_xp, updated_at = now()
  RETURNING updated_at INTO v_updated_at;

  RETURN jsonb_build_object(
    'awarded', v_award, 'total_xp', v_xp.total_xp,
    'week_key', v_xp.week_key, 'week_xp', v_xp.week_xp,
    'daily_lessons', v_xp.daily_lessons, 'updated_at', v_updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_cloudy_lesson_xp(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_cloudy_lesson_xp(uuid, integer, text) TO service_role;
