-- Preliminary Shorts audio transcription/moderation metadata and audit RPC.
-- Apply only to the separate Cloudy Content Supabase project after 0001–0005.

ALTER TABLE public.shorts_videos
  ADD COLUMN IF NOT EXISTS audio_analysis_status text NOT NULL DEFAULT 'pending'
    CHECK (audio_analysis_status IN ('pending', 'completed', 'unavailable')),
  ADD COLUMN IF NOT EXISTS audio_analysis_decision text NOT NULL DEFAULT 'review'
    CHECK (audio_analysis_decision IN ('allow', 'reject', 'review')),
  ADD COLUMN IF NOT EXISTS audio_analysis_labels jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(audio_analysis_labels) = 'array'),
  ADD COLUMN IF NOT EXISTS audio_analysis_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS audio_analysis_confidence numeric(4,3)
    CHECK (audio_analysis_confidence IS NULL OR audio_analysis_confidence BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS audio_analysis_model text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS audio_chunk_count integer NOT NULL DEFAULT 0
    CHECK (audio_chunk_count BETWEEN 0 AND 9),
  ADD COLUMN IF NOT EXISTS audio_analyzed_at timestamptz;

CREATE OR REPLACE FUNCTION public.apply_shorts_audio_analysis(
  p_video_id uuid,
  p_status text,
  p_reason text,
  p_labels jsonb,
  p_confidence numeric,
  p_model text,
  p_chunk_count integer,
  p_decision text
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
    RAISE EXCEPTION 'Invalid audio analysis status';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('allow', 'reject', 'review') THEN
    RAISE EXCEPTION 'Invalid audio analysis decision';
  END IF;
  IF char_length(safe_reason) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Audio analysis reason must contain 1 to 500 characters';
  END IF;
  IF p_labels IS NULL OR jsonb_typeof(p_labels) <> 'array' OR jsonb_array_length(p_labels) > 12 THEN
    RAISE EXCEPTION 'Invalid audio analysis labels';
  END IF;
  IF p_confidence IS NULL OR p_confidence < 0 OR p_confidence > 1 THEN
    RAISE EXCEPTION 'Invalid audio analysis confidence';
  END IF;
  IF p_chunk_count IS NULL OR p_chunk_count < 0 OR p_chunk_count > 9 THEN
    RAISE EXCEPTION 'Invalid audio chunk count';
  END IF;
  IF char_length(coalesce(p_model, '')) > 240 THEN
    RAISE EXCEPTION 'Audio analysis model is too long';
  END IF;

  SELECT author_id INTO target_author_id
    FROM public.shorts_videos
    WHERE id = p_video_id
      AND status = 'pending_review'
      AND moderation_status = 'needs_human_review'
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.shorts_videos
    SET audio_analysis_status = p_status,
        audio_analysis_decision = p_decision,
        audio_analysis_reason = safe_reason,
        audio_analysis_labels = p_labels,
        audio_analysis_confidence = p_confidence,
        audio_analysis_model = coalesce(p_model, ''),
        audio_chunk_count = p_chunk_count,
        audio_analyzed_at = now(),
        updated_at = now()
    WHERE id = p_video_id;

  INSERT INTO public.content_moderation_events (
    content_type, content_id, user_id, actor_type, action, reason,
    labels, confidence, model, policy_version
  ) VALUES (
    'short_video', p_video_id, target_author_id, 'cloudy_ai', 'escalate',
    safe_reason, p_labels, p_confidence, coalesce(p_model, ''),
    'cloudy-shorts-audio-triage-v1'
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_shorts_audio_analysis(uuid, text, text, jsonb, numeric, text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shorts_audio_analysis(uuid, text, text, jsonb, numeric, text, integer, text)
  TO service_role;
