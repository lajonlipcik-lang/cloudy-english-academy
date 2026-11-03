-- Cloudy AI Vault: administrator-only access policies.
-- The table and its columns are created by 0001_cloudy_ai_vault.sql.

ALTER TABLE public.ai_provider_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_provider_admin_select" ON public.ai_provider_secrets;
DROP POLICY IF EXISTS "ai_provider_admin_insert" ON public.ai_provider_secrets;
DROP POLICY IF EXISTS "ai_provider_admin_update" ON public.ai_provider_secrets;
DROP POLICY IF EXISTS "ai_provider_admin_delete" ON public.ai_provider_secrets;

CREATE POLICY "ai_provider_admin_select"
ON public.ai_provider_secrets
FOR SELECT TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "ai_provider_admin_insert"
ON public.ai_provider_secrets
FOR INSERT TO authenticated
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "ai_provider_admin_update"
ON public.ai_provider_secrets
FOR UPDATE TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "ai_provider_admin_delete"
ON public.ai_provider_secrets
FOR DELETE TO authenticated
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

REVOKE ALL ON public.ai_provider_secrets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_secrets TO authenticated;
GRANT ALL ON public.ai_provider_secrets TO service_role;
