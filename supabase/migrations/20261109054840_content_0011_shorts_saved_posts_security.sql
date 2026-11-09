-- Lock down saved Shorts rows. All reads/writes are performed server-side
-- through the verified Core Auth + Content service-role path.
ALTER TABLE public.shorts_saved_posts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.shorts_saved_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.shorts_saved_posts TO service_role;
