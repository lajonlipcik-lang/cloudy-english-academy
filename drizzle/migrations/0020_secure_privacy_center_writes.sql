-- Secure optional AI-training consent and privacy request writes behind
-- authenticated server functions. The service role remains the only writer.
REVOKE INSERT, UPDATE, DELETE ON public.optional_consent_events FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.privacy_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.optional_consent_events, public.privacy_requests TO authenticated;
GRANT ALL ON public.optional_consent_events, public.privacy_requests TO service_role;

DROP POLICY IF EXISTS optional_consent_owner_insert ON public.optional_consent_events;
DROP POLICY IF EXISTS privacy_requests_owner_insert ON public.privacy_requests;

-- Users may inspect only their own consent history and privacy requests.
DROP POLICY IF EXISTS optional_consent_owner_read ON public.optional_consent_events;
CREATE POLICY optional_consent_owner_read ON public.optional_consent_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS privacy_requests_owner_read ON public.privacy_requests;
CREATE POLICY privacy_requests_owner_read ON public.privacy_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
