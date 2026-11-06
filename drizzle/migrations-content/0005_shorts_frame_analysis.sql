-- Preliminary Shorts frame-analysis metadata and audit RPC.
-- Apply only to the separate Cloudy Content Supabase project after 0001–0004.

ALTER TABLE public.shorts_videos
  ADD COLUMN IF NOT EXISTS frame_analysis_status text NOT NULL DEFAULT 'pending'
    CHECK (frame_analysis_status IN ('pending', 'completed', 'unavailable')),
  ADD COLUMN IF NOT EXISTS frame_analysis_labels jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(frame_analysis_labels) = 'array'),
  ADD COLUMN IF NOT EXISTS frame_analysis_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS frame_analysis_confidence numeric(4,3)
    CHECK (frame_analysis_confidence IS NULL OR frame_analysis_confidence BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS frame_analysis_model text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS frame_count integer NOT NULL DEFAULT 0
    CHECK (frame_count BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS frame_analyzed_at timestamptz;

CREATE OR REPLACE FUNCTION public.apply_shorts_frame_analysis(
  p_video_id uuid,
  p_status text,
  p_reason text,
  p_labels jsonb,
  p_confidence numeric,
  p_model text,
  p_frame_count integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_author_id uuid;
  safe_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('completed', 'unavailable') THEN
    RAISE EXCEPTION 'Invalid frame analysis status';
  END IF;
  IF char_length(safe_reason) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Frame analysis reason must contain 1 to 500 characters';
  END IF;
  IF p_labels IS NULL OR jsonb_typeof(p_labels) <> 'array' OR jsonb_array_length(p_labels) > 12 THEN
    RAISE EXCEPTION 'Invalid frame analysis labels';
  END IF;
  IF p_confidence IS NULL OR p_confidence < 0 OR p_confidence > 1 THEN
    RAISE EXCEPTION 'Invalid frame analysis confidence';
  END IF;
  IF p_frame_count IS NULL OR p_frame_count < 0 OR p_frame_count > 6 THEN
    RAISE EXCEPTION 'Invalid frame count';
  END IF;
  IF char_length(coalesce(p_model, '')) > 120 THEN
    RAISE EXCEPTION 'Frame analysis model is too long';
  END IF;

  SELECT author_id INTO target_author_id
    FROM public.shorts_videos
    WHERE id = p_video_id
      AND status = 'pending_review'
      AND moderation_status = 'needs_human_review'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.shorts_videos
    SET frame_analysis_status = p_status,
        frame_analysis_reason = safe_reason,
        frame_analysis_labels = p_labels,
        frame_analysis_confidence = p_confidence,
        frame_analysis_model = coalesce(p_model, ''),
        frame_count = p_frame_count,
        frame_analyzed_at = now(),
        updated_at = now()
    WHERE id = p_video_id;

  INSERT INTO public.content_moderation_events (
    content_type, content_id, user_id, actor_type, action, reason,
    labels, confidence, model, policy_version
  ) VALUES (
    'short_video', p_video_id, target_author_id, 'cloudy_ai', 'escalate',
    safe_reason, p_labels, p_confidence, coalesce(p_model, ''),
    'cloudy-shorts-frame-triage-v1'
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_shorts_frame_analysis(uuid, text, text, jsonb, numeric, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shorts_frame_analysis(uuid, text, text, jsonb, numeric, text, integer)
  TO service_role;
