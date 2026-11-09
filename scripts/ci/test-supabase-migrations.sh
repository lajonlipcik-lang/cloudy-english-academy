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
supabase migration new "shorts_text_only_moderation" < scripts/ci/shorts_text_only_moderation.sql
sleep 1

supabase start
supabase db reset

psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f scripts/ci/assert-shorts-moderation.sql
