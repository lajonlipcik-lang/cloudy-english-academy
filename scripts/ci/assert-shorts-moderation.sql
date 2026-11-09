DO $$
DECLARE
  author_id uuid := gen_random_uuid();
  text_allow_id uuid := gen_random_uuid();
  text_reject_id uuid := gen_random_uuid();
  text_review_id uuid := gen_random_uuid();
  video_id uuid := gen_random_uuid();
  image_id uuid := gen_random_uuid();
  comment_video_id uuid := gen_random_uuid();
  comment_id uuid := gen_random_uuid();
  applied boolean;
  row_data public.shorts_videos%ROWTYPE;
  comment_data public.shorts_comments%ROWTYPE;
  function_is_definer boolean;
  function_signature text := 'public.apply_shorts_text_moderation(text,uuid,text,text,jsonb,numeric,text,text)';
BEGIN
  INSERT INTO public.shorts_videos
    (id, author_id, storage_path, caption, status, moderation_status, duration_seconds, media_type, text_content)
  VALUES
    (text_allow_id, author_id, NULL, 'safe learning note', 'draft', 'pending', NULL, 'text', 'A short English learning note.'),
    (text_reject_id, author_id, NULL, 'spam', 'draft', 'pending', NULL, 'text', 'Repeated spam advertising.'),
    (text_review_id, author_id, NULL, 'unclear', 'draft', 'pending', NULL, 'text', 'Ambiguous text requiring a person.'),
    (video_id, author_id, 'test/video.mp4', 'safe caption', 'draft', 'pending', 10, 'video', ''),
    (image_id, author_id, 'test/image.jpg', 'safe caption', 'draft', 'pending', NULL, 'image', ''),
    (comment_video_id, author_id, 'test/comment-parent.mp4', 'parent', 'approved', 'needs_human_review', 10, 'video', '');

  applied := public.apply_shorts_text_moderation(
    'short_video', text_allow_id, 'allow', 'Safe and relevant learning text.',
    '[]'::jsonb, 0.99, 'test-model', 'ci-test'
  );
  IF applied IS DISTINCT FROM true THEN RAISE EXCEPTION 'Text allow did not apply'; END IF;
  SELECT * INTO row_data FROM public.shorts_videos WHERE id = text_allow_id;
  IF row_data.status <> 'approved' OR row_data.moderation_status <> 'approved' OR row_data.published_at IS NULL
    THEN RAISE EXCEPTION 'Text allow did not publish the text-only post'; END IF;

  applied := public.apply_shorts_text_moderation(
    'short_video', text_reject_id, 'reject', 'Clear spam violation.',
    '["spam"]'::jsonb, 0.99, 'test-model', 'ci-test'
  );
  IF applied IS DISTINCT FROM true THEN RAISE EXCEPTION 'Text reject did not apply'; END IF;
  SELECT * INTO row_data FROM public.shorts_videos WHERE id = text_reject_id;
  IF row_data.status <> 'removed' OR row_data.moderation_status <> 'rejected' OR row_data.published_at IS NOT NULL
    THEN RAISE EXCEPTION 'Text reject transition is incorrect'; END IF;

  applied := public.apply_shorts_text_moderation(
    'short_video', text_review_id, 'review', 'Needs human review.',
    '["unclear"]'::jsonb, 0.55, 'test-model', 'ci-test'
  );
  IF applied IS DISTINCT FROM true THEN RAISE EXCEPTION 'Text review did not apply'; END IF;
  SELECT * INTO row_data FROM public.shorts_videos WHERE id = text_review_id;
  IF row_data.status <> 'pending_review' OR row_data.moderation_status <> 'needs_human_review' OR row_data.published_at IS NOT NULL
    THEN RAISE EXCEPTION 'Text review transition is incorrect'; END IF;

  applied := public.apply_shorts_text_moderation(
    'short_video', video_id, 'allow', 'Safe caption only.',
    '[]'::jsonb, 0.99, 'test-model', 'ci-test'
  );
  IF applied IS DISTINCT FROM false THEN RAISE EXCEPTION 'Text moderation must not approve a video'; END IF;
  SELECT * INTO row_data FROM public.shorts_videos WHERE id = video_id;
  IF row_data.status <> 'draft' OR row_data.moderation_status <> 'pending' OR row_data.published_at IS NOT NULL
    THEN RAISE EXCEPTION 'Video state changed through text moderation'; END IF;

  applied := public.apply_shorts_text_moderation(
    'short_video', image_id, 'allow', 'Safe caption only.',
    '[]'::jsonb, 0.99, 'test-model', 'ci-test'
  );
  IF applied IS DISTINCT FROM false THEN RAISE EXCEPTION 'Text moderation must not approve a photo'; END IF;
  SELECT * INTO row_data FROM public.shorts_videos WHERE id = image_id;
  IF row_data.status <> 'draft' OR row_data.moderation_status <> 'pending' OR row_data.published_at IS NOT NULL
    THEN RAISE EXCEPTION 'Photo state changed through text moderation'; END IF;

  INSERT INTO public.shorts_comments
    (id, video_id, author_id, body, status, moderation_status)
  VALUES (comment_id, comment_video_id, author_id, 'A helpful comment.', 'pending_review', 'pending');
  applied := public.apply_shorts_text_moderation(
    'short_comment', comment_id, 'allow', 'Safe comment.',
    '[]'::jsonb, 0.99, 'test-model', 'ci-test'
  );
  IF applied IS DISTINCT FROM true THEN RAISE EXCEPTION 'Comment allow did not apply'; END IF;
  SELECT * INTO comment_data FROM public.shorts_comments WHERE id = comment_id;
  IF comment_data.status <> 'published' OR comment_data.moderation_status <> 'approved'
    THEN RAISE EXCEPTION 'Comment allow transition is incorrect'; END IF;

  IF has_function_privilege('anon', function_signature, 'EXECUTE')
    OR has_function_privilege('authenticated', function_signature, 'EXECUTE') THEN
    RAISE EXCEPTION 'Browser roles must not execute the moderation RPC';
  END IF;
  IF NOT has_function_privilege('service_role', function_signature, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute the moderation RPC';
  END IF;
  SELECT prosecdef INTO function_is_definer
    FROM pg_proc WHERE oid = function_signature::regprocedure;
  IF function_is_definer THEN RAISE EXCEPTION 'Moderation RPC must run as SECURITY INVOKER'; END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.shorts_saved_posts'::regclass)
    THEN RAISE EXCEPTION 'shorts_saved_posts RLS is not enabled'; END IF;
  IF has_table_privilege('anon', 'public.shorts_saved_posts', 'SELECT')
    OR has_table_privilege('authenticated', 'public.shorts_saved_posts', 'SELECT')
    THEN RAISE EXCEPTION 'Browser roles must not read saved Shorts posts'; END IF;
  IF NOT has_table_privilege('service_role', 'public.shorts_saved_posts', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.shorts_saved_posts', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.shorts_saved_posts', 'DELETE')
    THEN RAISE EXCEPTION 'service_role saved-post privileges are incomplete'; END IF;
END;
$$;

SELECT 'Shorts moderation and saved-post security checks passed' AS result;
