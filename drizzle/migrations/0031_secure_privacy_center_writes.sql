-- Restrict privacy-center writes to the trusted server-side service role.
-- Authenticated users retain read-only access to their own records through RLS.
REVOKE ALL PRIVILEGES ON TABLE public.optional_consent_events
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.privacy_requests
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.optional_consent_events, public.privacy_requests
  TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.optional_consent_events, public.privacy_requests
  TO service_role;

DROP POLICY IF EXISTS optional_consent_owner_insert ON public.optional_consent_events;
DROP POLICY IF EXISTS privacy_requests_owner_insert ON public.privacy_requests;

DROP POLICY IF EXISTS optional_consent_owner_read ON public.optional_consent_events;
CREATE POLICY optional_consent_owner_read ON public.optional_consent_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS privacy_requests_owner_read ON public.privacy_requests;
CREATE POLICY privacy_requests_owner_read ON public.privacy_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
