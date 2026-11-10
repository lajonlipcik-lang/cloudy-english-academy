-- Per-user Cloudy Lite token quota: 30,000 actual Groq tokens per UTC day.
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
  settled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

CREATE INDEX IF NOT EXISTS cloudy_token_reservations_user_date_idx
  ON public.cloudy_token_reservations(user_id, usage_date);

ALTER TABLE public.cloudy_daily_token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloudy_token_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cloudy_daily_token_usage FROM anon, authenticated;
REVOKE ALL ON public.cloudy_token_reservations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_cloudy_daily_tokens(
  _user_id uuid, _request_id uuid, _estimated_tokens integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_date date := (now() AT TIME ZONE 'UTC')::date;
  v_row public.cloudy_daily_token_usage%ROWTYPE;
BEGIN
  IF _estimated_tokens < 1 OR _estimated_tokens > 30000 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_estimate');
  END IF;
  INSERT INTO public.cloudy_daily_token_usage(user_id, usage_date)
  VALUES (_user_id, v_date) ON CONFLICT (user_id, usage_date) DO NOTHING;

  UPDATE public.cloudy_daily_token_usage
  SET reserved_tokens = reserved_tokens + _estimated_tokens, updated_at = now()
  WHERE user_id = _user_id AND usage_date = v_date
    AND used_tokens + reserved_tokens + _estimated_tokens <= 30000
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.cloudy_daily_token_usage
    WHERE user_id = _user_id AND usage_date = v_date FOR UPDATE;
    RETURN jsonb_build_object(
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

  RETURN jsonb_build_object(
    'allowed', true, 'used_tokens', v_row.used_tokens,
    'reserved_tokens', v_row.reserved_tokens,
    'remaining_tokens', greatest(0, 30000 - v_row.used_tokens - v_row.reserved_tokens),
    'limit_tokens', 30000,
    'resets_at', ((v_date + 1)::timestamp AT TIME ZONE 'UTC')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_cloudy_daily_tokens(
  _request_id uuid, _actual_tokens integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_res public.cloudy_token_reservations%ROWTYPE;
  v_row public.cloudy_daily_token_usage%ROWTYPE;
  v_actual integer := greatest(0, least(coalesce(_actual_tokens, 0), 1000000));
BEGIN
  SELECT * INTO v_res FROM public.cloudy_token_reservations
  WHERE request_id = _request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reservation_not_found');
  END IF;
  IF v_res.settled THEN
    SELECT * INTO v_row FROM public.cloudy_daily_token_usage
    WHERE user_id = v_res.user_id AND usage_date = v_res.usage_date;
    RETURN jsonb_build_object(
      'ok', true, 'used_tokens', v_row.used_tokens,
      'reserved_tokens', v_row.reserved_tokens,
      'remaining_tokens', greatest(0, 30000 - v_row.used_tokens - v_row.reserved_tokens),
      'limit_tokens', 30000,
      'resets_at', ((v_res.usage_date + 1)::timestamp AT TIME ZONE 'UTC')
    );
  END IF;

  UPDATE public.cloudy_daily_token_usage
  SET reserved_tokens = greatest(0, reserved_tokens - v_res.reserved_tokens),
      used_tokens = used_tokens + v_actual,
      updated_at = now()
  WHERE user_id = v_res.user_id AND usage_date = v_res.usage_date
  RETURNING * INTO v_row;

  UPDATE public.cloudy_token_reservations
  SET settled = true, settled_at = now()
  WHERE request_id = _request_id;

  RETURN jsonb_build_object(
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_date date := (now() AT TIME ZONE 'UTC')::date;
  v_row public.cloudy_daily_token_usage%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.cloudy_daily_token_usage
  WHERE user_id = _user_id AND usage_date = v_date;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'used_tokens', 0, 'reserved_tokens', 0,
      'remaining_tokens', 30000, 'limit_tokens', 30000,
      'resets_at', ((v_date + 1)::timestamp AT TIME ZONE 'UTC')
    );
  END IF;
  RETURN jsonb_build_object(
    'used_tokens', v_row.used_tokens,
    'reserved_tokens', v_row.reserved_tokens,
    'remaining_tokens', greatest(0, 30000 - v_row.used_tokens - v_row.reserved_tokens),
    'limit_tokens', 30000,
    'resets_at', ((v_date + 1)::timestamp AT TIME ZONE 'UTC')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_cloudy_daily_tokens(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_cloudy_daily_tokens(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_cloudy_daily_token_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_cloudy_daily_tokens(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_cloudy_daily_tokens(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cloudy_daily_token_quota(uuid) TO service_role;
