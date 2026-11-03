-- Atomic per-user AI request limits and short-lived concurrency leases.
CREATE TABLE IF NOT EXISTS public.cloudy_ai_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  minute_started_at timestamptz NOT NULL DEFAULT now(),
  minute_count integer NOT NULL DEFAULT 0 CHECK (minute_count >= 0),
  daily_key date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  daily_count integer NOT NULL DEFAULT 0 CHECK (daily_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cloudy_ai_request_leases (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS cloudy_ai_request_leases_user_expiry_idx
  ON public.cloudy_ai_request_leases(user_id, expires_at);

ALTER TABLE public.cloudy_ai_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloudy_ai_request_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cloudy_ai_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cloudy_ai_request_leases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cloudy_ai_rate_limits TO service_role;
GRANT ALL ON public.cloudy_ai_request_leases TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_cloudy_ai_request(_user_id uuid, _request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.cloudy_ai_rate_limits%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_day date := (clock_timestamp() AT TIME ZONE 'UTC')::date;
  v_active integer;
  v_retry integer;
BEGIN
  IF _user_id IS NULL OR _request_id IS NULL THEN
    RAISE EXCEPTION 'Invalid AI request identity';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));
  DELETE FROM public.cloudy_ai_request_leases
  WHERE user_id = _user_id AND expires_at <= v_now;

  INSERT INTO public.cloudy_ai_rate_limits(user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row
  FROM public.cloudy_ai_rate_limits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF v_row.daily_key <> v_day THEN
    v_row.daily_key := v_day;
    v_row.daily_count := 0;
  END IF;
  IF v_row.minute_started_at <= v_now - interval '1 minute' THEN
    v_row.minute_started_at := v_now;
    v_row.minute_count := 0;
  END IF;

  IF v_row.daily_count >= 120 THEN
    v_retry := GREATEST(1, ceil(extract(epoch FROM ((v_now AT TIME ZONE 'UTC')::date + 1 - (v_now AT TIME ZONE 'UTC'))))::integer);
    RETURN jsonb_build_object('allowed', false, 'reason', 'daily', 'retry_after', v_retry);
  END IF;
  IF v_row.minute_count >= 12 THEN
    v_retry := GREATEST(1, ceil(extract(epoch FROM (v_row.minute_started_at + interval '1 minute' - v_now)))::integer);
    RETURN jsonb_build_object('allowed', false, 'reason', 'minute', 'retry_after', v_retry);
  END IF;

  SELECT count(*) INTO v_active
  FROM public.cloudy_ai_request_leases
  WHERE user_id = _user_id AND expires_at > v_now;
  IF v_active >= 2 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'concurrent', 'retry_after', 10);
  END IF;

  UPDATE public.cloudy_ai_rate_limits
  SET minute_started_at = v_row.minute_started_at,
      minute_count = v_row.minute_count + 1,
      daily_key = v_row.daily_key,
      daily_count = v_row.daily_count + 1,
      updated_at = v_now
  WHERE user_id = _user_id;

  INSERT INTO public.cloudy_ai_request_leases(request_id, user_id, expires_at)
  VALUES (_request_id, _user_id, v_now + interval '2 minutes');

  RETURN jsonb_build_object('allowed', true, 'remaining_minute', 11 - v_row.minute_count, 'remaining_day', 119 - v_row.daily_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_cloudy_ai_request(_user_id uuid, _request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _request_id IS NULL THEN RETURN false; END IF;
  DELETE FROM public.cloudy_ai_request_leases
  WHERE user_id = _user_id AND request_id = _request_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_cloudy_ai_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_cloudy_ai_request(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_cloudy_ai_request(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_cloudy_ai_request(uuid, uuid) TO service_role;
