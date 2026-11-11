-- Atomic per-user Shorts comment rate limit.
-- Keep the write path behind service_role; callers must validate the Core Auth token first.
CREATE OR REPLACE FUNCTION public.create_shorts_comment_rate_limited(
  p_video_id uuid,
  p_author_id uuid,
  p_body text,
  p_parent_comment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_recent_count integer;
  v_video_status text;
  v_parent_video_id uuid;
  v_parent_status text;
BEGIN
  IF p_author_id IS NULL OR p_video_id IS NULL OR p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'INVALID_COMMENT';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_author_id::text, 0));

  SELECT status INTO v_video_status
  FROM public.shorts_videos
  WHERE id = p_video_id;

  IF v_video_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'VIDEO_NOT_AVAILABLE';
  END IF;

  IF p_parent_comment_id IS NOT NULL THEN
    SELECT video_id, status INTO v_parent_video_id, v_parent_status
    FROM public.shorts_comments
    WHERE id = p_parent_comment_id;

    IF v_parent_video_id IS DISTINCT FROM p_video_id OR v_parent_status IS DISTINCT FROM 'published' THEN
      RAISE EXCEPTION 'PARENT_COMMENT_NOT_AVAILABLE';
    END IF;
  END IF;

  SELECT count(*) INTO v_recent_count
  FROM public.shorts_comments
  WHERE author_id = p_author_id
    AND created_at > now() - interval '1 minute'
    AND status IN ('published', 'pending_review');

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'COMMENT_RATE_LIMIT';
  END IF;

  INSERT INTO public.shorts_comments (
    video_id, author_id, body, parent_comment_id,
    status, moderation_status, moderated_at
  )
  VALUES (
    p_video_id, p_author_id, btrim(p_body), p_parent_comment_id,
    'published', 'approved', now()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_shorts_comment_rate_limited(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_shorts_comment_rate_limited(uuid, uuid, text, uuid)
  TO service_role;
