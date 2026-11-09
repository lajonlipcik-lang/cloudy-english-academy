-- Ensure deleting a Supabase auth user also deletes their cloud progress row.
-- NOT VALID avoids failing deployment if legacy orphan rows already exist;
-- PostgreSQL still enforces the FK for new writes and cascades future user deletes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_progress'::regclass
      AND conname = 'user_progress_user_id_auth_users_fk'
  ) THEN
    ALTER TABLE public.user_progress
      ADD CONSTRAINT user_progress_user_id_auth_users_fk
      FOREIGN KEY (user_id) REFERENCES auth.users(id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END
$$;
