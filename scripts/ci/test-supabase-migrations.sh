#!/usr/bin/env bash
set -euo pipefail

# Build an ephemeral, timestamped Supabase CLI migration history from the
# reviewed legacy SQL tracks. No remote project is linked or contacted.
if [[ -f supabase/.temp/project-ref ]]; then
  echo "Refusing to run with a linked Supabase project." >&2
  exit 1
fi
mkdir -p supabase/migrations

create_from_file() {
  local source="$1"
  local base="${source##*/}"
  local name="${base%.sql}"
  local track="$2"
  echo "Generating local migration: ${track}_${name}"
  supabase migration new "${track}_${name}" < "$source"
  # Supabase migration versions are second-resolution timestamps.
  sleep 1
}

# Core Auth/profile/progress/community foundation.
for source in drizzle/migrations/000[0-9]_*.sql drizzle/migrations/001[0-5]_*.sql; do
  [[ -f "$source" ]] || continue
  create_from_file "$source" core
done

# Shorts tables and supporting RPCs must exist before Core's Shorts RPCs.
for source in drizzle/migrations-content/000[2-8]_*.sql; do
  [[ -f "$source" ]] || continue
  create_from_file "$source" content
done
for source in \
  drizzle/migrations-content/0009_shorts_follows.sql \
  drizzle/migrations-content/0009_shorts_saved_posts.sql \
  drizzle/migrations-content/0010_shorts_comment_interactions.sql \
  drizzle/migrations-content/0011_shorts_saved_posts_security.sql; do
  create_from_file "$source" content
done

# These Core migrations reference the Shorts tables above.
for source in drizzle/migrations/001[6-9]_*.sql drizzle/migrations/0020_*.sql; do
  [[ -f "$source" ]] || continue
  create_from_file "$source" core
done

# Additive fix: keep historical migration 0017 immutable while restoring
# moderation for text-only posts. Video/image rows are never changed here.
supabase migration new "shorts_text_only_moderation" <<'SQL'
CREATE OR REPLACE FUNCTION public.apply_shorts_text_moderation(
  p_content_type text,
  p_content_id uuid,
  p_decision text,
  p_reason text,
  p_labels jsonb,
  p_confidence numeric,
  p_model text DEFAULT '',
  p_policy_version text DEFAULT 'cloudy-content-text-v1'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_author_id uuid;
  safe_reason text := btrim(coalesce(p_reason, ''));
  next_status text;
  next_moderation_status text;
  event_action text;
BEGIN
  IF p_content_type IS NULL OR p_content_type NOT IN ('short_comment', 'short_video')
    OR p_decision IS NULL OR p_decision NOT IN ('allow', 'reject', 'review')
    OR char_length(safe_reason) NOT BETWEEN 1 AND 500
    OR p_labels IS NULL OR jsonb_typeof(p_labels) <> 'array' OR jsonb_array_length(p_labels) > 12
    OR p_confidence IS NULL OR p_confidence NOT BETWEEN 0 AND 1
    OR char_length(coalesce(p_model, '')) > 120
    OR char_length(coalesce(p_policy_version, '')) > 80 THEN
    RAISE EXCEPTION 'Invalid Shorts text moderation';
  END IF;

  IF p_content_type = 'short_comment' THEN
    SELECT author_id INTO target_author_id
      FROM public.shorts_comments
      WHERE id = p_content_id AND moderation_status = 'pending'
      FOR UPDATE;
  ELSE
    SELECT author_id INTO target_author_id
      FROM public.shorts_videos
      WHERE id = p_content_id
        AND status = 'draft'
        AND moderation_status = 'pending'
        AND media_type = 'text'
      FOR UPDATE;
    -- Only text-only drafts may be changed by this RPC.
    IF NOT FOUND THEN
      RETURN false;
    END IF;
  END IF;

  IF p_content_type = 'short_comment' AND NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_decision = 'reject' THEN
    next_status := 'removed';
    next_moderation_status := 'rejected';
    event_action := 'reject';
  ELSIF p_decision = 'allow' THEN
    next_status := CASE WHEN p_content_type = 'short_comment' THEN 'published' ELSE 'approved' END;
    next_moderation_status := 'approved';
    event_action := 'approve';
  ELSE
    next_status := 'pending_review';
    next_moderation_status := 'needs_human_review';
    event_action := 'escalate';
  END IF;

  IF p_content_type = 'short_comment' THEN
    UPDATE public.shorts_comments
      SET status = next_status,
          moderation_status = next_moderation_status,
          moderation_reason = safe_reason,
          moderation_labels = p_labels,
          moderated_at = now(),
          updated_at = now()
      WHERE id = p_content_id;
  ELSE
    UPDATE public.shorts_videos
      SET status = next_status,
          moderation_status = next_moderation_status,
          moderation_reason = safe_reason,
          moderation_labels = p_labels,
          moderated_at = now(),
          published_at = CASE WHEN p_decision = 'allow' THEN now() ELSE NULL END,
          updated_at = now()
      WHERE id = p_content_id
        AND media_type = 'text';
  END IF;

  INSERT INTO public.content_moderation_events
    (content_type, content_id, user_id, actor_type, action, reason, labels, confidence, model, policy_version)
  VALUES
    (p_content_type, p_content_id, target_author_id, 'cloudy_ai', event_action,
     safe_reason, p_labels, p_confidence, coalesce(p_model, ''), coalesce(p_policy_version, ''));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_shorts_text_moderation(text, uuid, text, text, jsonb, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shorts_text_moderation(text, uuid, text, text, jsonb, numeric, text, text)
  TO service_role;
SQL

supabase start
supabase db reset

psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f scripts/ci/assert-shorts-moderation.sql
