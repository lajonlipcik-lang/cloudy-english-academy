-- Persist the learner's CEFR placement independently of device-local state.
-- Keep the complete course state in user_progress; this profile snapshot is the
-- authoritative fallback used during sign-in/session restoration.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS english_level text,
  ADD COLUMN IF NOT EXISTS placement_test_completed boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_english_level_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_english_level_check
      CHECK (english_level IS NULL OR english_level IN ('A1', 'A2', 'B1', 'B2'));
  END IF;
END
$$;

-- Recover existing placement results from the already-persisted progress JSON.
UPDATE public.profiles p
SET english_level = up.state->>'lv',
    placement_test_completed = COALESCE(up.state->>'tested' IN ('1', 'true'), false)
FROM public.user_progress up
WHERE up.user_id = p.id
  AND up.state->>'lv' IN ('A1', 'A2', 'B1', 'B2');

-- Preserve an explicitly supplied updated_at from the concurrency-safe save RPC.
-- The previous trigger replaced it with transaction time, so the RPC returned a
-- timestamp that could differ from the actual row version and cause false conflicts.
CREATE OR REPLACE FUNCTION public.sync_progress_columns() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.week_key := COALESCE(NEW.state->'wk'->>'k', '');
  NEW.week_xp := LEAST(GREATEST(COALESCE((NEW.state->'wk'->>'xp')::int, 0), 0), 100000);
  NEW.total_xp := GREATEST(COALESCE((NEW.state->>'xp')::int, 0), 0);
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.save_cloudy_progress(_user_id uuid, _state jsonb, _expected_updated_at timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp public.user_progress_xp%ROWTYPE;
  v_current public.user_progress%ROWTYPE;
  v_state jsonb;
  v_updated_at timestamptz;
  v_exists boolean := false;
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

  SELECT * INTO v_current
  FROM public.user_progress
  WHERE user_id = _user_id
  FOR UPDATE;
  v_exists := FOUND;

  IF v_exists AND date_trunc('milliseconds', _expected_updated_at) IS DISTINCT FROM date_trunc('milliseconds', v_current.updated_at) THEN
    v_state := jsonb_set(COALESCE(v_current.state, '{}'::jsonb), '{xp}', to_jsonb(v_xp.total_xp), true);
    v_state := jsonb_set(v_state, '{wk}', jsonb_build_object('k', v_xp.week_key, 'xp', v_xp.week_xp), true);
    RETURN jsonb_build_object(
      'ok', false,
      'conflict', true,
      'state', v_state,
      'updated_at', v_current.updated_at
    );
  END IF;

  v_state := jsonb_set(COALESCE(_state, '{}'::jsonb), '{xp}', to_jsonb(v_xp.total_xp), true);
  v_state := jsonb_set(v_state, '{wk}', jsonb_build_object('k', v_xp.week_key, 'xp', v_xp.week_xp), true);

  v_updated_at := date_trunc('milliseconds', clock_timestamp());
  INSERT INTO public.user_progress (user_id, state, total_xp, week_key, week_xp, updated_at)
  VALUES (_user_id, v_state, v_xp.total_xp, v_xp.week_key, v_xp.week_xp, v_updated_at)
  ON CONFLICT (user_id) DO UPDATE
  SET state = EXCLUDED.state, total_xp = EXCLUDED.total_xp,
      week_key = EXCLUDED.week_key, week_xp = EXCLUDED.week_xp, updated_at = EXCLUDED.updated_at
  RETURNING updated_at INTO v_updated_at;

  UPDATE public.profiles
  SET english_level = CASE
        WHEN v_state->>'lv' IN ('A1', 'A2', 'B1', 'B2') THEN v_state->>'lv'
        ELSE english_level
      END,
      placement_test_completed = placement_test_completed OR COALESCE(v_state->>'tested' IN ('1', 'true'), false)
  WHERE id = _user_id;

  RETURN jsonb_build_object('ok', true, 'conflict', false, 'state', v_state, 'updated_at', v_updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.save_cloudy_progress(uuid, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cloudy_progress(uuid, jsonb, timestamptz) TO service_role;
