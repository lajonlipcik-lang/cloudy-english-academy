-- Persist the per-user learner profile used to personalize Cloudy AI.
-- The server derives identity from the verified Supabase session and accesses
-- this table through the service-role client; browser clients get no table access.
CREATE TABLE IF NOT EXISTS public.user_learning_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The table may predate this migration in an existing Lovable database.
-- Add the object-shape guard independently so existing data is preserved.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_learning_profiles'::regclass
      AND conname = 'user_learning_profiles_profile_object_check'
  ) THEN
    ALTER TABLE public.user_learning_profiles
      ADD CONSTRAINT user_learning_profiles_profile_object_check
      CHECK (jsonb_typeof(profile) = 'object') NOT VALID;
    ALTER TABLE public.user_learning_profiles
      VALIDATE CONSTRAINT user_learning_profiles_profile_object_check;
  END IF;
END
$$;

ALTER TABLE public.user_learning_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.user_learning_profiles
  FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.user_learning_profiles
  TO service_role;

COMMENT ON TABLE public.user_learning_profiles IS
  'Private per-user Cloudy learning profile snapshot used to personalize AI tutoring and exams. Contains derived learning evidence, not credentials.';
