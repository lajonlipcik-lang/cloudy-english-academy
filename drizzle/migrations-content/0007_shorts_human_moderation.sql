-- Atomic human moderation actions for Cloudy Shorts.
-- Apply only to the separate Cloudy Content Supabase project after 0001–0006.

CREATE OR REPLACE FUNCTION public.moderate_shorts_video(
  p_video_id uuid,
  p_decision text,
  p_moderator_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_author_id uuid;
  safe_reason text := btrim(coalesce(p_reason, ''));
  next_status text;
  event_action text;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid Shorts moderation decision';
  END IF;
  IF p_moderator_id IS NULL THEN
    RAISE EXCEPTION 'Moderator identity is required';
  END IF;
  IF char_length(safe_reason) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'A moderation reason of 1 to 1000 characters is required';
  END IF;

  SELECT author_id INTO target_author_id
    FROM public.shorts_videos
    WHERE id = p_video_id
      AND status = 'pending_review'
      AND moderation_status IN ('pending', 'needs_human_review')
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  next_status := CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END;
  event_action := CASE WHEN p_decision = 'approve' THEN 'approve' ELSE 'reject' END;

  UPDATE public.shorts_videos
    SET status = next_status,
        moderation_status = CASE WHEN p_decision = 'approve' THEN 'approved' ELSE 'rejected' END,
        moderation_reason = safe_reason,
        moderated_at = now(),
        published_at = CASE WHEN p_decision = 'approve' THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = p_video_id;

  INSERT INTO public.content_moderation_events (
    content_type, content_id, user_id, actor_type, action, reason,
    labels, confidence, model, policy_version
  ) VALUES (
    'short_video', p_video_id, target_author_id, 'admin', event_action,
    safe_reason, '[]'::jsonb, NULL, 'human-moderator',
    'cloudy-shorts-human-review-v1'
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_shorts_video(uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_shorts_video(uuid, text, uuid, text)
  TO service_role;
