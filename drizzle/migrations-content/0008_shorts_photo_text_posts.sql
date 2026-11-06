-- Extend Shorts to safe photo and text posts while preserving legacy video rows.
ALTER TABLE public.shorts_videos
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS text_content text NOT NULL DEFAULT '';

ALTER TABLE public.shorts_videos ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE public.shorts_videos DROP CONSTRAINT IF EXISTS shorts_videos_media_type_check;
ALTER TABLE public.shorts_videos ADD CONSTRAINT shorts_videos_media_type_check
  CHECK (media_type IN ('video','image','text'));
ALTER TABLE public.shorts_videos DROP CONSTRAINT IF EXISTS shorts_videos_text_content_length;
ALTER TABLE public.shorts_videos ADD CONSTRAINT shorts_videos_text_content_length
  CHECK (char_length(text_content) <= 2000);
ALTER TABLE public.shorts_videos DROP CONSTRAINT IF EXISTS shorts_videos_media_shape_check;
ALTER TABLE public.shorts_videos ADD CONSTRAINT shorts_videos_media_shape_check CHECK (
  (media_type = 'video' AND storage_path IS NOT NULL AND duration_seconds IS NOT NULL)
  OR (media_type = 'image' AND storage_path IS NOT NULL AND duration_seconds IS NULL AND text_content = '')
  OR (media_type = 'text' AND storage_path IS NULL AND duration_seconds IS NULL
      AND char_length(btrim(text_content)) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS shorts_posts_feed_idx
  ON public.shorts_videos (published_at DESC, media_type)
  WHERE status = 'approved';

-- The same private bucket stores photos. Videos retain the existing 100 MB limit;
-- server-side validation applies the stricter 15 MB photo limit.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['video/mp4','video/webm','video/quicktime','image/jpeg','image/png','image/webp'],
    file_size_limit = 104857600,
    public = false
WHERE id = 'cloudy-shorts';

-- Publish only non-video media after its own trusted AI review. Ambiguous or
-- unavailable AI results remain private for human review; only explicit 18+ blocks.
CREATE OR REPLACE FUNCTION public.finalize_shorts_nonvideo_publication(
  p_post_id uuid, p_author_id uuid, p_blocked boolean, p_status text,
  p_reason text, p_labels jsonb, p_confidence numeric, p_model text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target public.shorts_videos%ROWTYPE; blocked boolean;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('completed','unavailable')
    OR p_labels IS NULL OR jsonb_typeof(p_labels) <> 'array' OR jsonb_array_length(p_labels) > 12
    OR p_confidence IS NULL OR p_confidence NOT BETWEEN 0 AND 1
    OR char_length(coalesce(p_reason,'')) NOT BETWEEN 1 AND 500
    OR char_length(coalesce(p_model,'')) > 120 THEN
    RAISE EXCEPTION 'Invalid non-video publication analysis';
  END IF;
  SELECT * INTO target FROM public.shorts_videos
    WHERE id=p_post_id AND author_id=p_author_id AND status='draft'
      AND media_type IN ('image','text')
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  blocked := coalesce(p_blocked,false) AND p_status='completed'
    AND p_confidence>=0.95
    AND p_labels ?| ARRAY['pornography','sexual_nudity','sexual_act'];
  UPDATE public.shorts_videos
    SET status=CASE WHEN blocked THEN 'pending_review' ELSE 'approved' END,
        moderation_status='needs_human_review',
        published_at=CASE WHEN blocked THEN NULL ELSE now() END,
        moderation_reason=p_reason, moderation_labels=p_labels,
        frame_analysis_status=p_status, frame_analysis_reason=p_reason,
        frame_analysis_labels=p_labels, frame_analysis_confidence=p_confidence,
        frame_analysis_model=coalesce(p_model,''), frame_count=CASE WHEN media_type='image' THEN 1 ELSE 0 END,
        frame_analyzed_at=now(), updated_at=now()
    WHERE id=p_post_id;
  INSERT INTO public.content_moderation_events
    (content_type,content_id,user_id,actor_type,action,reason,labels,confidence,model,policy_version)
  VALUES ('short_video',p_post_id,p_author_id,'cloudy_ai',
    CASE WHEN blocked THEN 'escalate' ELSE 'approve' END,p_reason,p_labels,p_confidence,
    coalesce(p_model,''),'shorts-nonvideo-explicit-18-only-v1');
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.finalize_shorts_nonvideo_publication(uuid,uuid,boolean,text,text,jsonb,numeric,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_shorts_nonvideo_publication(uuid,uuid,boolean,text,text,jsonb,numeric,text)
  TO service_role;

-- An allowed text-only post may publish. An allowed video/image caption never
-- approves the underlying media.
CREATE OR REPLACE FUNCTION public.apply_shorts_text_moderation(
  p_content_type text, p_content_id uuid, p_decision text, p_reason text,
  p_labels jsonb, p_confidence numeric, p_model text DEFAULT '',
  p_policy_version text DEFAULT 'cloudy-content-text-v1'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target_author_id uuid; target_media_type text; next_status text;
  next_moderation_status text; event_action text; safe_reason text := btrim(coalesce(p_reason,''));
BEGIN
  IF p_content_type IS NULL OR p_content_type NOT IN ('short_comment','short_video')
    OR p_decision IS NULL OR p_decision NOT IN ('allow','reject','review')
    OR char_length(safe_reason) NOT BETWEEN 1 AND 500
    OR p_labels IS NULL OR jsonb_typeof(p_labels)<>'array' OR jsonb_array_length(p_labels)>12
    OR p_confidence IS NULL OR p_confidence NOT BETWEEN 0 AND 1
    OR char_length(coalesce(p_model,''))>120 OR char_length(coalesce(p_policy_version,''))>80
    THEN RAISE EXCEPTION 'Invalid Shorts text moderation'; END IF;
  IF p_content_type='short_comment' THEN
    SELECT author_id INTO target_author_id FROM public.shorts_comments
      WHERE id=p_content_id AND moderation_status='pending' FOR UPDATE;
  ELSE
    SELECT author_id,media_type INTO target_author_id,target_media_type FROM public.shorts_videos
      WHERE id=p_content_id AND moderation_status='pending' FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_decision='reject' THEN
    next_status:=CASE WHEN p_content_type='short_comment' THEN 'removed' ELSE 'removed' END;
    next_moderation_status:='rejected'; event_action:='reject';
  ELSIF p_decision='allow' AND p_content_type='short_comment' THEN
    next_status:='published'; next_moderation_status:='approved'; event_action:='approve';
  ELSIF p_decision='allow' AND target_media_type='text' THEN
    next_status:='approved'; next_moderation_status:='needs_human_review'; event_action:='approve';
  ELSE
    next_status:='pending_review'; next_moderation_status:='needs_human_review'; event_action:='escalate';
  END IF;
  IF p_content_type='short_comment' THEN
    UPDATE public.shorts_comments SET status=next_status,moderation_status=next_moderation_status,
      moderation_reason=safe_reason,moderation_labels=p_labels,moderated_at=now(),updated_at=now()
      WHERE id=p_content_id;
  ELSE
    UPDATE public.shorts_videos SET status=next_status,moderation_status=next_moderation_status,
      moderation_reason=safe_reason,moderation_labels=p_labels,moderated_at=now(),
      published_at=CASE WHEN target_media_type='text' AND p_decision='allow' THEN now() ELSE NULL END,
      updated_at=now() WHERE id=p_content_id;
  END IF;
  INSERT INTO public.content_moderation_events
    (content_type,content_id,user_id,actor_type,action,reason,labels,confidence,model,policy_version)
  VALUES (p_content_type,p_content_id,target_author_id,'cloudy_ai',event_action,safe_reason,
    p_labels,p_confidence,coalesce(p_model,''),coalesce(p_policy_version,''));
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.apply_shorts_text_moderation(text,uuid,text,text,jsonb,numeric,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shorts_text_moderation(text,uuid,text,text,jsonb,numeric,text,text)
  TO service_role;
