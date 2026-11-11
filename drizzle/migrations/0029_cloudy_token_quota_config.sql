-- Follow-up to 0028 (do not edit 0028: it may already be applied).
-- Keep the free Lite quota configurable without exposing token balances in the UI.
-- A request estimate above the configured daily limit is rejected separately
-- from a user who has exhausted today's budget.

CREATE TABLE IF NOT EXISTS public.cloudy_token_quota_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  daily_limit integer NOT NULL DEFAULT 30000 CHECK (daily_limit BETWEEN 1000 AND 10000000),
  warning_ratio numeric(4, 3) NOT NULL DEFAULT 0.800 CHECK (warning_ratio > 0 AND warning_ratio <= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.cloudy_token_quota_config(id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.cloudy_token_quota_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cloudy_token_quota_config FROM PUBLIC, anon, authenticated;

ALTER TABLE public.cloudy_token_usage_events
  DROP CONSTRAINT IF EXISTS cloudy_token_usage_events_usage_source_check;
ALTER TABLE public.cloudy_token_usage_events
  ADD CONSTRAINT cloudy_token_usage_events_usage_source_check
  CHECK (usage_source IN ('groq', 'gemini', 'provider', 'estimate'));

-- Cost fields are list-price estimates for the attributed provider/model, not invoice data.
-- In particular, a provider's free-tier allowance may make the actual billed amount zero.
COMMENT ON COLUMN public.cloudy_token_usage_events.input_cost_usd IS
  'Estimated USD equivalent using the provider/model public input rate; not an invoice charge.';
COMMENT ON COLUMN public.cloudy_token_usage_events.output_cost_usd IS
  'Estimated USD equivalent using the provider/model public output rate; not an invoice charge.';
COMMENT ON COLUMN public.cloudy_token_usage_events.total_cost_usd IS
  'Estimated USD equivalent using public provider/model rates; not an invoice charge.';

CREATE OR REPLACE FUNCTION public.cloudy_daily_token_limit()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT coalesce((SELECT daily_limit FROM public.cloudy_token_quota_config WHERE id), 30000);
$$;

CREATE OR REPLACE FUNCTION public.cloudy_token_warning_threshold()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT pg_catalog.ceil(
    public.cloudy_daily_token_limit() *
    coalesce((SELECT warning_ratio FROM public.cloudy_token_quota_config WHERE id), 0.8)
  )::integer;
$$;

CREATE OR REPLACE FUNCTION public.reserve_cloudy_daily_tokens(
  _user_id uuid, _request_id uuid, _estimated_tokens integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_date date := (pg_catalog.now() AT TIME ZONE 'UTC')::date;
  v_limit integer := public.cloudy_daily_token_limit();
  v_warn integer := public.cloudy_token_warning_threshold();
  v_resets timestamptz := ((v_date + 1)::timestamp AT TIME ZONE 'UTC');
  v_row public.cloudy_daily_token_usage%ROWTYPE;
BEGIN
  IF _estimated_tokens IS NULL OR _estimated_tokens < 1 OR _estimated_tokens > v_limit THEN
    RETURN pg_catalog.jsonb_build_object(
      'allowed', false, 'reason', 'invalid_estimate',
      'limit_tokens', v_limit, 'resets_at', v_resets
    );
  END IF;

  INSERT INTO public.cloudy_daily_token_usage(user_id, usage_date)
  VALUES (_user_id, v_date) ON CONFLICT (user_id, usage_date) DO NOTHING;

  -- Expired reservations are released once. A late provider settlement may
  -- still add its actual usage, but must not subtract the reservation twice.
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

  -- Atomic check-and-reserve: concurrent requests cannot reserve the same
  -- remaining budget twice.
  UPDATE public.cloudy_daily_token_usage
  SET reserved_tokens = reserved_tokens + _estimated_tokens, updated_at = pg_catalog.now()
  WHERE user_id = _user_id AND usage_date = v_date
    AND used_tokens + reserved_tokens + _estimated_tokens <= v_limit
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.cloudy_daily_token_usage
    WHERE user_id = _user_id AND usage_date = v_date;
    RETURN pg_catalog.jsonb_build_object(
      'allowed', false, 'reason', 'daily',
      'used_tokens', v_row.used_tokens, 'reserved_tokens', v_row.reserved_tokens,
      'remaining_tokens', greatest(0, v_limit - v_row.used_tokens - v_row.reserved_tokens),
      'limit_tokens', v_limit, 'resets_at', v_resets, 'warning', true
    );
  END IF;

  INSERT INTO public.cloudy_token_reservations(request_id, user_id, usage_date, reserved_tokens)
  VALUES (_request_id, _user_id, v_date, _estimated_tokens);

  RETURN pg_catalog.jsonb_build_object(
    'allowed', true,
    'used_tokens', v_row.used_tokens, 'reserved_tokens', v_row.reserved_tokens,
    'remaining_tokens', greatest(0, v_limit - v_row.used_tokens - v_row.reserved_tokens),
    'limit_tokens', v_limit, 'resets_at', v_resets,
    'warning', (v_row.used_tokens + v_row.reserved_tokens) >= v_warn
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
  v_limit integer := public.cloudy_daily_token_limit();
  v_warn integer := public.cloudy_token_warning_threshold();
  v_actual integer := greatest(0, least(coalesce(_actual_tokens, 0), 1000000));
  v_real boolean := _usage_source IN ('groq', 'gemini', 'provider');
  v_source text;
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
      'ok', true, 'used_tokens', v_row.used_tokens, 'reserved_tokens', v_row.reserved_tokens,
      'remaining_tokens', greatest(0, v_limit - v_row.used_tokens - v_row.reserved_tokens),
      'limit_tokens', v_limit,
      'resets_at', ((v_res.usage_date + 1)::timestamp AT TIME ZONE 'UTC'),
      'warning', (v_row.used_tokens + v_row.reserved_tokens) >= v_warn
    );
  END IF;

  IF v_res.status = 'released' THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'reason', 'reservation_released');
  END IF;

  v_source := CASE
    WHEN _usage_source = 'groq' THEN 'groq'
    WHEN _usage_source = 'gemini' THEN 'gemini'
    WHEN _usage_source = 'provider' THEN 'provider'
    ELSE 'estimate'
  END;

  -- Only calculate cost when the event is attributable to one Groq provider
  -- and a model with a known published price. Unknown/mixed sources stay NULL.
  IF v_real AND _prompt_tokens IS NOT NULL AND _completion_tokens IS NOT NULL
     AND coalesce(_provider, 'groq') = 'groq' THEN
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
    IF v_input_rate IS NOT NULL THEN
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
      CASE WHEN v_real THEN _prompt_tokens END,
      CASE WHEN v_real THEN _completion_tokens END,
      v_actual, v_source,
      v_input_cost, v_output_cost,
      CASE WHEN v_input_cost IS NOT NULL AND v_output_cost IS NOT NULL THEN v_input_cost + v_output_cost END
    ) ON CONFLICT (request_id) DO NOTHING;
  END IF;

  UPDATE public.cloudy_token_reservations
  SET status = 'settled', settled_at = pg_catalog.now()
  WHERE request_id = _request_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'used_tokens', v_row.used_tokens, 'reserved_tokens', v_row.reserved_tokens,
    'remaining_tokens', greatest(0, v_limit - v_row.used_tokens - v_row.reserved_tokens),
    'limit_tokens', v_limit,
    'resets_at', ((v_res.usage_date + 1)::timestamp AT TIME ZONE 'UTC'),
    'warning', (v_row.used_tokens + v_row.reserved_tokens) >= v_warn
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_cloudy_daily_token_quota(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_date date := (pg_catalog.now() AT TIME ZONE 'UTC')::date;
  v_limit integer := public.cloudy_daily_token_limit();
  v_warn integer := public.cloudy_token_warning_threshold();
  v_row public.cloudy_daily_token_usage%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.cloudy_daily_token_usage
  WHERE user_id = _user_id AND usage_date = v_date;

  RETURN pg_catalog.jsonb_build_object(
    'used_tokens', coalesce(v_row.used_tokens, 0),
    'reserved_tokens', coalesce(v_row.reserved_tokens, 0),
    'remaining_tokens', greatest(0, v_limit - coalesce(v_row.used_tokens, 0) - coalesce(v_row.reserved_tokens, 0)),
    'limit_tokens', v_limit,
    'resets_at', ((v_date + 1)::timestamp AT TIME ZONE 'UTC'),
    'warning', (coalesce(v_row.used_tokens, 0) + coalesce(v_row.reserved_tokens, 0)) >= v_warn
  );
END;
$$;

-- Optional retention helper. No scheduler or paid service is created here.
CREATE OR REPLACE FUNCTION public.purge_cloudy_token_reservations(_retain_days integer DEFAULT 14)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
DECLARE v_deleted integer;
BEGIN
  DELETE FROM public.cloudy_token_reservations r
  WHERE r.created_at < pg_catalog.now() - pg_catalog.make_interval(days => greatest(1, _retain_days))
    AND r.status IN ('expired', 'released', 'settled')
    AND NOT EXISTS (SELECT 1 FROM public.cloudy_token_usage_events e WHERE e.request_id = r.request_id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cloudy_daily_token_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cloudy_token_warning_threshold() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_cloudy_daily_tokens(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_cloudy_daily_tokens(uuid, integer, integer, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_cloudy_daily_token_quota(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_cloudy_token_reservations(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cloudy_daily_token_limit() TO service_role;
GRANT EXECUTE ON FUNCTION public.cloudy_token_warning_threshold() TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_cloudy_daily_tokens(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_cloudy_daily_tokens(uuid, integer, integer, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cloudy_daily_token_quota(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_cloudy_token_reservations(integer) TO service_role;
