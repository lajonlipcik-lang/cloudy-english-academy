CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Ученик',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_progress (
  user_id uuid PRIMARY KEY,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  week_key text NOT NULL DEFAULT '',
  week_xp integer NOT NULL DEFAULT 0,
  total_xp integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_progress TO authenticated;
GRANT ALL ON public.user_progress TO service_role;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress read" ON public.user_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own progress insert" ON public.user_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own progress update" ON public.user_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own progress delete" ON public.user_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.sync_progress_columns() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.week_key := COALESCE(NEW.state->'wk'->>'k', '');
  NEW.week_xp := LEAST(GREATEST(COALESCE((NEW.state->'wk'->>'xp')::int, 0), 0), 100000);
  NEW.total_xp := GREATEST(COALESCE((NEW.state->>'xp')::int, 0), 0);
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sync_progress BEFORE INSERT OR UPDATE ON public.user_progress
FOR EACH ROW EXECUTE FUNCTION public.sync_progress_columns();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(left(NEW.raw_user_meta_data->>'name', 40), ''), 'Ученик'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- League: real users only, exposes display name + weekly XP, never emails/ids of others
CREATE OR REPLACE FUNCTION public.get_weekly_league(_week text)
RETURNS TABLE(display_name text, week_xp integer, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(p.display_name, 'Ученик'), up.week_xp, up.user_id = auth.uid()
  FROM public.user_progress up
  LEFT JOIN public.profiles p ON p.id = up.user_id
  WHERE auth.uid() IS NOT NULL AND up.week_key = _week AND (up.week_xp > 0 OR up.user_id = auth.uid())
  ORDER BY up.week_xp DESC
  LIMIT 30
$$;
REVOKE ALL ON FUNCTION public.get_weekly_league(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_league(text) TO authenticated;