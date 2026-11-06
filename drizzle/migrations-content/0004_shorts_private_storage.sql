-- Private video storage for Cloudy Shorts. Apply only to the Cloudy Content database
-- after 0001 and 0002. Uploads use short-lived signed upload capabilities.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cloudy-shorts',
  'cloudy-shorts',
  false,
  104857600,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Do not add browser-role policies for this bucket. Supabase Storage RLS
-- denies direct access by default; the server uses service_role and issues
-- narrowly scoped signed upload capabilities after Core Auth verification.

CREATE INDEX IF NOT EXISTS shorts_videos_pending_upload_idx
  ON public.shorts_videos (author_id, created_at DESC)
  WHERE status = 'draft';
