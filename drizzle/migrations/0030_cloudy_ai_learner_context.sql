-- Persist the per-user learner profile used to personalize Cloudy AI.
-- The server derives identity from the verified Supabase session and accesses
-- this table through the service-role client; browser clients get no table access.
CREATE TABLE IF NOT EXISTS public.user_learning_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(profile) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_learning_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.user_learning_profiles
  FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.user_learning_profiles
  TO service_role;

COMMENT ON TABLE public.user_learning_profiles IS
  'Private per-user Cloudy learning profile snapshot used to personalize AI tutoring and exams. Contains derived learning evidence, not credentials.';
