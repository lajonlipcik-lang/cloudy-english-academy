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

if compgen -G "supabase/migrations/*.sql" > /dev/null; then
  echo "Using committed canonical Supabase migrations."
else
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

  # Keep historical migration 0017 immutable; this additive migration restores
  # moderation for text-only posts and refuses to change video/image rows.
  supabase migration new "shorts_text_only_moderation" < scripts/ci/shorts_text_only_moderation.sql
  sleep 1
fi

migration_count="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
if [[ "$migration_count" != "33" ]]; then
  echo "Expected 33 canonical migrations, found $migration_count." >&2
  exit 1
fi

supabase start
supabase db reset

psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 \
  -f scripts/ci/assert-shorts-moderation.sql
