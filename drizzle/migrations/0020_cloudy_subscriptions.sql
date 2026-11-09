-- Cloudy subscription foundation.
-- Payment-provider callbacks are the only trusted writers for paid access.
-- Never grant authenticated clients INSERT/UPDATE/DELETE on these tables.

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]{1,47}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '',
  price_minor bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  billing_interval text NOT NULL DEFAULT 'none'
    CHECK (billing_interval IN ('none', 'day', 'week', 'month', 'year')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  is_active boolean NOT NULL DEFAULT false,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(entitlements) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.subscription_plans
  (code, name, description, price_minor, currency, billing_interval, interval_count, is_active, entitlements)
VALUES
  ('free', 'Бесплатный', 'Базовый бесплатный тариф Cloudy English', 0, 'USD', 'none', 1, true, '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'expired')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  checkout_session_id text,
  starts_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  ended_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (current_period_end IS NULL OR current_period_start IS NULL OR current_period_end > current_period_start),
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx
  ON public.subscriptions (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_period_end_idx
  ON public.subscriptions (current_period_end)
  WHERE status IN ('trialing', 'active', 'canceled');
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_subscription_uidx
  ON public.subscriptions (provider, provider_subscription_id)
  WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_payment_id text,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL
    CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  paid_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (subscription_id IS NULL OR user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS subscription_payments_user_created_idx
  ON public.subscription_payments (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_provider_payment_uidx
  ON public.subscription_payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.subscription_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key text NOT NULL CHECK (feature_key ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  enabled boolean NOT NULL DEFAULT true,
  usage_limit bigint CHECK (usage_limit IS NULL OR usage_limit >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, feature_key),
  FOREIGN KEY (subscription_id, user_id)
    REFERENCES public.subscriptions(id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS subscription_entitlements_user_feature_idx
  ON public.subscription_entitlements (user_id, feature_key);

-- Provider webhook inbox: unique event IDs make retries idempotent.
-- Raw payloads are private and must never be exposed to app clients.
CREATE TABLE IF NOT EXISTS public.subscription_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  UNIQUE (provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS subscription_provider_events_pending_idx
  ON public.subscription_provider_events (received_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_provider_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.subscription_payments TO authenticated;
GRANT SELECT ON public.subscription_entitlements TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.subscription_plans FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_entitlements FROM anon, authenticated;
REVOKE ALL ON public.subscription_provider_events FROM anon, authenticated;

GRANT ALL ON public.subscription_plans TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.subscription_payments TO service_role;
GRANT ALL ON public.subscription_entitlements TO service_role;
GRANT ALL ON public.subscription_provider_events TO service_role;

DROP POLICY IF EXISTS "active plans are readable" ON public.subscription_plans;
CREATE POLICY "active plans are readable"
  ON public.subscription_plans FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "users read own subscriptions" ON public.subscriptions;
CREATE POLICY "users read own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users read own payments" ON public.subscription_payments;
CREATE POLICY "users read own payments"
  ON public.subscription_payments FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users read own entitlements" ON public.subscription_entitlements;
CREATE POLICY "users read own entitlements"
  ON public.subscription_entitlements FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.id = subscription_entitlements.subscription_id
        AND s.user_id = (select auth.uid())
    )
  );


-- The database, not the mobile client, decides whether the latest subscription
-- currently grants access. Prefer a still-valid paid period over an unfinished
-- checkout row so starting a renewal does not revoke an existing entitlement.
CREATE OR REPLACE VIEW public.my_subscription_access
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.status,
  CASE
    WHEN s.status IN ('active', 'trialing') THEN
      (s.current_period_end IS NULL OR s.current_period_end > now())
    WHEN s.status = 'canceled' THEN
      (s.current_period_end IS NOT NULL AND s.current_period_end > now())
    ELSE false
  END AS has_access,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  s.canceled_at,
  p.code AS plan_code,
  p.name AS plan_name,
  p.entitlements AS plan_entitlements
FROM public.subscriptions s
JOIN public.subscription_plans p ON p.id = s.plan_id
WHERE s.user_id = (select auth.uid())
  AND s.id = (
    SELECT latest.id
    FROM public.subscriptions latest
    WHERE latest.user_id = (select auth.uid())
    ORDER BY
      CASE
        WHEN latest.status IN ('active', 'trialing')
          AND (latest.current_period_end IS NULL OR latest.current_period_end > now()) THEN 0
        WHEN latest.status = 'canceled'
          AND latest.current_period_end > now() THEN 0
        ELSE 1
      END,
      latest.created_at DESC,
      latest.id DESC
    LIMIT 1
  );

GRANT SELECT ON public.my_subscription_access TO authenticated;

-- Provider events intentionally have no client-facing policies or grants.
