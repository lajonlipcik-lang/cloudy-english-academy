-- Per-user Cloudy Lite quota and private per-request usage ledger.
CREATE TABLE IF NOT EXISTS public.cloudy_daily_token_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  used_tokens integer NOT NULL DEFAULT 0 CHECK (used_tokens >= 0),
  reserved_tokens integer NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

CREATE TABLE IF NOT EXISTS public.cloudy_token_reservations (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  reserved_tokens integer NOT NULL CHECK (reserved_tokens > 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'expired', 'released', 'settled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX IF NOT EXISTS cloudy_token_reservations_user_date_idx
  ON public.cloudy_token_reservations(user_id, usage_date);

CREATE TABLE IF NOT EXISTS public.cloudy_token_usage_events (
  request_id uuid PRIMARY KEY REFERENCES public.cloudy_token_reservations(request_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer NOT NULL CHECK (total_tokens >= 0),
  usage_source text NOT NULL CHECK (usage_source IN ('groq', 'estimate')),
  input_cost_usd numeric(18, 10),
  output_cost_usd numeric(18, 10),
  total_cost_usd numeric(18, 10),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cloudy_token_usage_events_user_date_idx
  ON public.cloudy_token_usage_events(user_id, usage_date);
CREATE INDEX IF NOT EXISTS cloudy_token_usage_events_created_idx
  ON public.cloudy_token_usage_events(created_at);

ALTER TABLE public.cloudy_daily_token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloudy_token_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloudy_token_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cloudy_daily_token_usage FROM anon, authenticated;
REVOKE ALL ON public.cloudy_token_reservations FROM anon, authenticated;
REVOKE ALL ON public.cloudy_token_usage_events FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_cloudy_daily_tokens(
  _user_id uuid, _request_id uuid, _estimated_tokens integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_date date := (pg_catalog.now() AT TIME ZONE 'UTC')::date;
  v_row public.cloudy_daily_token_usage%ROWTYPE;
BEGIN
  IF _estimated_tokens < 1 OR _estimated_tokens > 30000 THEN
    RETURN pg_catalog.jsonb_build_object('allowed', false, 'reason', 'invalid_estimate');
  END IF;

  INSERT INTO public.cloudy_daily_token_usage(user_id, usage_date)
  VALUES (_user_id, v_date) ON CONFLICT (user_id, usage_date) DO NOTHING;

  -- Release abandoned reservations after process crashes; only the current user's
  -- current UTC-day reservations are eligible for cleanup.
  WITH expired AS (
    UPDATE public.cloudy_token_reservations
    SET status = 'expired', settled_at = pg_catalog.now()
    WHERE user_id = _user_id AND usage_date = v_date
      AND status = 'reserved' AND expires_at <= pg_catalog.now()
    RETURNING reserved_tokens
  )
  UPDATE public.cloudy_daily_token_usage
  SET reserved_tokens = greatest(
    0, reserved_tokens - (SELECT coalesce(pg_catalog.sum(reserved_tokens), 0) FROM expired)
  ), updated_at = pg_catalog.now()
  WHERE user_id = _user_id AND usage_date = v_date;

  UPDATE public.cloudy_daily_token_usage
  SET reserved_tokens = reserved_tokens + _estimated_tokens, updated_at = pg_catalog.now()
  WHERE user_id = _user_id AND usage_date = v_date
    AND used_tokens + reserved_tokens + _estimated_tokens <= 30000
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.cloudy_daily_token_usage
    WHERE user_id = _user_id AND usage_date = v_date FOR UPDATE;
    RETURN pg_catalog.jsonb_build_object(
      'allowed', false, 'reason', 'daily',
      'used_tokens', v_row.used_tokens,
      'reserved_tokens', v_row.reserved_tokens,
      'remaining_tokens', greatest(0, 30000 - v_row.used_tokens - v_row.reserved_tokens),
      'limit_tokens', 30000,
      'resets_at', ((v_date + 1)::timestamp AT TIME ZONE 'UTC')
    );
  END IF;

  INSERT INTO public.cloudy_token_reservations(request_id, user_id, usage_date, reserved_tokens)
  VALUES (_request_id, _user_id, v_date, _estimated_tokens);

  RETURN pg_catalog.jsonb_build_object(
    'allowed', true, 'used_tokens', v_row.used_tokens,
    'reserved_tokens', v_row.reserved_tokens,
    'remaining_tokens', greatest(0, 30000 - v_row.used_tokens - v_row.reserved_tokens),
    'limit_tokens', 30000,
    'resets_at', ((v_date + 1)::timestamp AT TIME ZONE 'UTC')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_cloudy_daily_tokens(
  _request_id uuid,
  _actual_tokens integer,
  _prompt_tokens integer DEFAULT NULL,
  _completion_tokens integer DEFAULT NULL,
  _model text DEFAULT NULL,
  _provider text DEFAULT 'groq',
  _usage_source text DEFAULT 'estimate'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_res public.cloudy_token_reservations%ROWTYPE;
  v_row public.cloudy_daily_token_usage%ROWTYPE;
  v_actual integer := greatest(0, least(coalesce(_actual_tokens, 0), 1000000));
  v_input_rate numeric(18, 10);
  v_output_rate numeric(18, 10);
  v_input_cost numeric(18, 10);
  v_output_cost numeric(18, 10);
BEGIN
  SELECT * INTO v_res FROM public.cloudy_token_reservations
  WHERE request_id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'reservation_not_found');
  END IF;

  IF v_res.status = 'settled' THEN
    SELECT * INTO v_row FROM public.cloudy_daily_token_usage
    WHERE user_id = v_res.user_id AND usage_date = v_res.usage_date;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'used_tokens', v_row.used_tokens,
      'reserved_tokens', v_row.reserved_tokens,
      'remaining_tokens', greatest(0, 30000 - v_row.used_tokens - v_row.reserved_tokens),
      'limit_tokens', 30000,
      'resets_at', ((v_res.usage_date + 1)::timestamp AT TIME ZONE 'UTC')
    );
  END IF;

  IF v_res.status = 'released' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'reservation_released');
  END IF;

  IF _usage_source = 'groq' AND _prompt_tokens IS NOT NULL AND _completion_tokens IS NOT NULL THEN
    CASE _model
      WHEN 'openai/gpt-oss-20b' THEN
        v_input_rate := 0.075 / 1000000;
        v_output_rate := 0.30 / 1000000;
      WHEN 'openai/gpt-oss-120b' THEN
        v_input_rate := 0.15 / 1000000;
        v_output_rate := 0.60 / 1000000;
      ELSE
        v_input_rate := NULL;
        v_output_rate := NULL;
    END CASE;
    IF v_input_rate IS NOT NULL AND v_output_rate IS NOT NULL THEN
      v_input_cost := _prompt_tokens * v_input_rate;
      v_output_cost := _completion_tokens * v_output_rate;
    END IF;
  END IF;

  UPDATE public.cloudy_daily_token_usage
  SET reserved_tokens = CASE WHEN v_res.status = 'reserved'
        THEN greatest(0, reserved_tokens - v_res.reserved_tokens)
        ELSE reserved_tokens END,
      used_tokens = used_tokens + v_actual,
      updated_at = pg_catalog.now()
  WHERE user_id = v_res.user_id AND usage_date = v_res.usage_date
  RETURNING * INTO v_row;

  IF v_actual > 0 THEN
    INSERT INTO public.cloudy_token_usage_events(
      request_id, user_id, usage_date, provider, model,
      prompt_tokens, completion_tokens, total_tokens, usage_source,
      input_cost_usd, output_cost_usd, total_cost_usd
    ) VALUES (
      _request_id, v_res.user_id, v_res.usage_date,
      pg_catalog.left(coalesce(_provider, 'groq'), 40),
      pg_catalog.left(coalesce(_model, 'unknown'), 120),
      CASE WHEN _usage_source = 'groq' THEN _prompt_tokens ELSE NULL END,
      CASE WHEN _usage_source = 'groq' THEN _completion_tokens ELSE NULL END,
      v_actual,
      CASE WHEN _usage_source = 'groq' THEN 'groq' ELSE 'estimate' END,
      v_input_cost, v_output_cost,
      CASE WHEN v_input_cost IS NOT NULL AND v_output_cost IS NOT NULL THEN v_input_cost + v_output_cost ELSE NULL END
    ) ON CONFLICT (request_id) DO NOTHING;
  END IF;

  UPDATE public.cloudy_token_reservations
  SET status = 'settled', settled_at = pg_catalog.now()
  WHERE request_id = _request_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'used_tokens', v_row.used_tokens,
    'reserved_tokens', v_row.reserved_tokens,
    'remaining_tokens', greatest(0, 30000 - v_row.used_tokens - v_row.reserved_tokens),
    'limit_tokens', 30000,
    'resets_at', ((v_res.usage_date + 1)::timestamp AT TIME ZONE 'UTC')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cloudy_daily_token_quota(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_date date := (pg_catalog.now() AT TIME ZONE 'UTC')::date;
  v_row public.cloudy_daily_token_usage%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.cloudy_daily_token_usage
  WHERE user_id = _user_id AND usage_date = v_date;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'used_tokens', 0, 'reserved_tokens', 0,
      'remaining_tokens', 30000, 'limit_tokens', 30000,
      'resets_at', ((v_date + 1)::timestamp AT TIME ZONE 'UTC')
    );
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'used_tokens', v_row.used_tokens,
    'reserved_tokens', v_row.reserved_tokens,
    'remaining_tokens', greatest(0, 30000 - v_row.used_tokens - v_row.reserved_tokens),
    'limit_tokens', 30000,
    'resets_at', ((v_date + 1)::timestamp AT TIME ZONE 'UTC')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_cloudy_daily_tokens(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_cloudy_daily_tokens(uuid, integer, integer, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_cloudy_daily_token_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_cloudy_daily_tokens(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_cloudy_daily_tokens(uuid, integer, integer, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cloudy_daily_token_quota(uuid) TO service_role;
