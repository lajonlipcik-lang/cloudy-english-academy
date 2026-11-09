-- An expired/canceled paid period falls back to Cloudy Lite 2.2 automatically.
-- The view remains user-scoped via auth.uid() and exposes no provider event payloads.
CREATE OR REPLACE VIEW public.my_subscription_access
WITH (security_invoker = true)
AS
WITH paid AS (
  SELECT s.id, s.status, s.current_period_start, s.current_period_end,
         s.cancel_at_period_end, s.canceled_at, p.code AS plan_code,
         p.name AS plan_name, p.entitlements AS plan_entitlements
    FROM public.subscriptions s
    JOIN public.subscription_plans p ON p.id = s.plan_id
   WHERE s.user_id = (select auth.uid())
     AND p.code = 'cloudy_teacher'
     AND s.status IN ('active', 'trialing', 'canceled')
     AND s.current_period_end IS NOT NULL
     AND s.current_period_end > now()
   ORDER BY s.current_period_end DESC, s.created_at DESC
   LIMIT 1
), lite AS (
  SELECT id, code, name, entitlements
    FROM public.subscription_plans
   WHERE code = 'cloudy_lite' AND is_active = true
   LIMIT 1
)
SELECT
  paid.id,
  coalesce(paid.status, 'active') AS status,
  true AS has_access,
  paid.current_period_start,
  paid.current_period_end,
  coalesce(paid.cancel_at_period_end, false) AS cancel_at_period_end,
  paid.canceled_at,
  coalesce(paid.plan_code, lite.code) AS plan_code,
  coalesce(paid.plan_name, lite.name) AS plan_name,
  coalesce(paid.plan_entitlements, lite.entitlements) AS plan_entitlements
FROM lite
LEFT JOIN paid ON true;

GRANT SELECT ON public.my_subscription_access TO authenticated;
