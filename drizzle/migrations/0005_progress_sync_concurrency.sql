-- Optimistic concurrency for progress sync. Existing XP ledger and awards are untouched.
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

  IF v_exists AND _expected_updated_at IS DISTINCT FROM v_current.updated_at THEN
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

  v_updated_at := clock_timestamp();
  INSERT INTO public.user_progress (user_id, state, total_xp, week_key, week_xp, updated_at)
  VALUES (_user_id, v_state, v_xp.total_xp, v_xp.week_key, v_xp.week_xp, v_updated_at)
  ON CONFLICT (user_id) DO UPDATE
  SET state = EXCLUDED.state, total_xp = EXCLUDED.total_xp,
      week_key = EXCLUDED.week_key, week_xp = EXCLUDED.week_xp, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('ok', true, 'conflict', false, 'state', v_state, 'updated_at', v_updated_at);
END;
$$;

REVOKE ALL ON FUNCTION public.save_cloudy_progress(uuid, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_cloudy_progress(uuid, jsonb, timestamptz) TO service_role;
