CREATE OR REPLACE FUNCTION public.finalize_shorts_publication(p_video_id uuid, p_author_id uuid, p_blocked boolean, p_status text, p_reason text, p_labels jsonb, p_confidence numeric, p_model text, p_frame_count integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE target public.shorts_videos%ROWTYPE; blocked boolean;
BEGIN
 IF p_status NOT IN ('completed','unavailable') OR p_status IS NULL OR p_labels IS NULL OR jsonb_typeof(p_labels) <> 'array' OR jsonb_array_length(p_labels)>12 OR p_confidence IS NULL OR p_confidence NOT BETWEEN 0 AND 1 OR p_frame_count IS NULL OR p_frame_count NOT BETWEEN 0 AND 6 OR char_length(coalesce(p_reason,'')) NOT BETWEEN 1 AND 500 OR char_length(coalesce(p_model,''))>120 THEN RAISE EXCEPTION 'Invalid publication analysis'; END IF;
 SELECT * INTO target FROM public.shorts_videos WHERE id=p_video_id AND author_id=p_author_id AND status='draft' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 blocked := coalesce(p_blocked,false) AND p_status='completed' AND p_confidence>=0.95 AND p_labels ?| ARRAY['pornography','sexual_nudity','sexual_act'];
 UPDATE public.shorts_videos SET status=CASE WHEN blocked THEN 'pending_review' ELSE 'approved' END, moderation_status='needs_human_review', published_at=CASE WHEN blocked THEN NULL ELSE now() END, moderation_reason=p_reason, moderation_labels=p_labels, frame_analysis_status=p_status,frame_analysis_reason=p_reason,frame_analysis_labels=p_labels,frame_analysis_confidence=p_confidence,frame_analysis_model=coalesce(p_model,''),frame_count=p_frame_count,frame_analyzed_at=now(), updated_at=now() WHERE id=p_video_id;
 INSERT INTO public.content_moderation_events(content_type,content_id,user_id,actor_type,action,reason,labels,confidence,model,policy_version) VALUES ('short_video',p_video_id,p_author_id,'cloudy_ai',CASE WHEN blocked THEN 'escalate' ELSE 'approve' END,p_reason,p_labels,p_confidence,coalesce(p_model,''),'shorts-explicit-18-only-v2');
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.finalize_shorts_publication(uuid,uuid,boolean,text,text,jsonb,numeric,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_shorts_publication(uuid,uuid,boolean,text,text,jsonb,numeric,text,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.moderate_shorts_video(p_video_id uuid,p_decision text,p_moderator_id uuid,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target public.shorts_videos%ROWTYPE; next_status text; safe_reason text := btrim(coalesce(p_reason,''));
BEGIN
 IF p_decision IS NULL OR p_decision NOT IN ('approve','reject','hide','remove') OR p_moderator_id IS NULL OR char_length(safe_reason) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid moderator decision'; END IF;
 SELECT * INTO target FROM public.shorts_videos WHERE id=p_video_id AND status IN ('pending_review','approved','hidden','rejected') FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 next_status := CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'hide' THEN 'hidden' WHEN 'remove' THEN 'removed' ELSE 'rejected' END;
 UPDATE public.shorts_videos SET status=next_status,moderation_status=CASE WHEN p_decision='approve' THEN 'approved' ELSE 'rejected' END,moderation_reason=safe_reason,moderated_at=now(),published_at=CASE WHEN p_decision='approve' THEN coalesce(target.published_at,now()) ELSE NULL END,updated_at=now() WHERE id=p_video_id;
 INSERT INTO public.content_moderation_events(content_type,content_id,user_id,actor_type,action,reason,labels,confidence,model,policy_version) VALUES('short_video',p_video_id,target.author_id,'admin',CASE p_decision WHEN 'approve' THEN 'approve' WHEN 'hide' THEN 'hide' WHEN 'remove' THEN 'remove' ELSE 'reject' END,safe_reason,'[]',NULL,'human-moderator','shorts-post-publication-review-v2');
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.moderate_shorts_video(uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_shorts_video(uuid,text,uuid,text) TO service_role;
-- Legacy caption RPC remains usable for comments, but must never alter video publication.
CREATE OR REPLACE FUNCTION public.ignore_shorts_caption_publication() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status='removed' AND OLD.status IN ('draft','pending_review','approved') AND NEW.moderation_status='rejected' AND NEW.moderated_at IS DISTINCT FROM OLD.moderated_at AND NEW.frame_analysis_status=OLD.frame_analysis_status AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at THEN
  NEW.status := OLD.status; NEW.moderation_status := OLD.moderation_status; NEW.moderation_reason := OLD.moderation_reason; NEW.moderation_labels := OLD.moderation_labels; NEW.moderated_at := OLD.moderated_at;
 END IF;
 RETURN NEW;
END; $$;
