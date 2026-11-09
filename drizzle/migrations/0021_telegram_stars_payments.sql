-- Telegram Stars account linking, checkout orders and atomic payment fulfillment.
-- This migration is intentionally provider-specific only for Telegram Stars (XTR).
-- Apply only to the verified Cloudy Supabase project after project-ID reconciliation.

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_link_tokens_user_idx
  ON public.telegram_link_tokens (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_account_links (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_user_id bigint NOT NULL UNIQUE,
  telegram_chat_id bigint NOT NULL,
  telegram_username text,
  linked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  invoice_payload text NOT NULL UNIQUE CHECK (char_length(invoice_payload) BETWEEN 1 AND 128),
  telegram_user_id bigint NOT NULL,
  telegram_chat_id bigint NOT NULL,
  amount_stars integer NOT NULL CHECK (amount_stars BETWEEN 1 AND 10000),
  subscription_period_seconds integer NOT NULL DEFAULT 2592000
    CHECK (subscription_period_seconds = 2592000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'refunded')),
  invoice_message_id bigint,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  last_payment_at timestamptz,
  last_charge_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_payment_orders_user_idx
  ON public.telegram_payment_orders (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS telegram_payment_orders_one_pending_per_user_uidx
  ON public.telegram_payment_orders (user_id)
  WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS telegram_payment_orders_charge_uidx
  ON public.telegram_payment_orders (last_charge_id)
  WHERE last_charge_id IS NOT NULL;

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_account_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_payment_orders ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.telegram_account_links TO authenticated;
GRANT SELECT ON public.telegram_payment_orders TO authenticated;
REVOKE ALL ON public.telegram_link_tokens FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.telegram_account_links FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.telegram_payment_orders FROM anon, authenticated;
GRANT ALL ON public.telegram_link_tokens TO service_role;
GRANT ALL ON public.telegram_account_links TO service_role;
GRANT ALL ON public.telegram_payment_orders TO service_role;

DROP POLICY IF EXISTS "users read own telegram link" ON public.telegram_account_links;
CREATE POLICY "users read own telegram link"
  ON public.telegram_account_links FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users read own telegram payment orders" ON public.telegram_payment_orders;
CREATE POLICY "users read own telegram payment orders"
  ON public.telegram_payment_orders FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.consume_telegram_link_token(
  p_token_hash text,
  p_telegram_user_id bigint,
  p_telegram_chat_id bigint,
  p_telegram_username text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  UPDATE public.telegram_link_tokens
     SET consumed_at = now()
   WHERE token_hash = p_token_hash
     AND consumed_at IS NULL
     AND expires_at > now()
   RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Link token is invalid or expired';
  END IF;

  INSERT INTO public.telegram_account_links
    (user_id, telegram_user_id, telegram_chat_id, telegram_username, linked_at, updated_at)
  VALUES
    (v_user_id, p_telegram_user_id, p_telegram_chat_id,
     NULLIF(left(coalesce(p_telegram_username, ''), 64), ''), now(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    telegram_user_id = EXCLUDED.telegram_user_id,
    telegram_chat_id = EXCLUDED.telegram_chat_id,
    telegram_username = EXCLUDED.telegram_username,
    linked_at = now(),
    updated_at = now();

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_telegram_stars_payment(
  p_invoice_payload text,
  p_telegram_user_id bigint,
  p_telegram_payment_charge_id text,
  p_provider_payment_charge_id text,
  p_amount_stars integer,
  p_currency text,
  p_subscription_expires_at timestamptz,
  p_payment_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.telegram_payment_orders%ROWTYPE;
  v_subscription_id uuid;
  v_period_start timestamptz := now();
  v_period_end timestamptz;
BEGIN
  IF p_currency <> 'XTR'
     OR p_amount_stars < 1
     OR p_telegram_payment_charge_id IS NULL
     OR char_length(p_telegram_payment_charge_id) < 1 THEN
    RAISE EXCEPTION 'Invalid Telegram Stars payment details';
  END IF;

  SELECT * INTO v_order
    FROM public.telegram_payment_orders
   WHERE invoice_payload = p_invoice_payload
   FOR UPDATE;

  IF NOT FOUND
     OR v_order.telegram_user_id <> p_telegram_user_id
     OR v_order.amount_stars <> p_amount_stars
     OR v_order.status NOT IN ('pending', 'active')
     OR (v_order.status = 'pending' AND v_order.expires_at <= now()) THEN
    RAISE EXCEPTION 'Telegram Stars order does not match';
  END IF;

  SELECT id INTO v_subscription_id
    FROM public.subscriptions
   WHERE provider = 'telegram_stars'
     AND provider_subscription_id = v_order.id::text
   LIMIT 1
   FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.subscription_payments
     WHERE provider = 'telegram_stars'
       AND provider_payment_id = p_telegram_payment_charge_id
  ) THEN
    IF v_subscription_id IS NULL THEN
      SELECT subscription_id INTO v_subscription_id
        FROM public.telegram_payment_orders WHERE id = v_order.id;
    END IF;
    IF v_subscription_id IS NULL THEN
      RAISE EXCEPTION 'Duplicate Telegram payment has no subscription';
    END IF;
    RETURN v_subscription_id;
  END IF;

  v_period_end := coalesce(p_subscription_expires_at, now() + interval '30 days');
  IF v_period_end <= now() THEN
    RAISE EXCEPTION 'Telegram subscription period is already expired';
  END IF;

  IF v_subscription_id IS NULL THEN
    INSERT INTO public.subscriptions (
      user_id, plan_id, status, provider, provider_customer_id,
      provider_subscription_id, starts_at, current_period_start,
      current_period_end, metadata
    ) VALUES (
      v_order.user_id, v_order.plan_id, 'active', 'telegram_stars',
      v_order.telegram_user_id::text, v_order.id::text, v_period_start,
      v_period_start, v_period_end,
      jsonb_build_object('telegram_chat_id', v_order.telegram_chat_id)
    )
    RETURNING id INTO v_subscription_id;
  ELSE
    UPDATE public.subscriptions
       SET status = 'active',
           current_period_start = v_period_start,
           current_period_end = v_period_end,
           ended_at = NULL,
           updated_at = now()
     WHERE id = v_subscription_id
       AND user_id = v_order.user_id;
  END IF;

  INSERT INTO public.subscription_payments (
    user_id, subscription_id, provider, provider_payment_id,
    amount_minor, currency, status, paid_at, metadata
  ) VALUES (
    v_order.user_id, v_subscription_id, 'telegram_stars',
    p_telegram_payment_charge_id, p_amount_stars, 'XTR', 'succeeded', now(),
    coalesce(p_payment_metadata, '{}'::jsonb) ||
      jsonb_build_object('provider_payment_charge_id', p_provider_payment_charge_id)
  );

  UPDATE public.telegram_payment_orders
     SET status = 'active',
         subscription_id = v_subscription_id,
         paid_at = coalesce(paid_at, now()),
         last_payment_at = now(),
         last_charge_id = p_telegram_payment_charge_id,
         updated_at = now()
   WHERE id = v_order.id;

  RETURN v_subscription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_telegram_link_token(text, bigint, bigint, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_telegram_stars_payment(text, bigint, text, text, integer, text, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_telegram_link_token(text, bigint, bigint, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_telegram_stars_payment(text, bigint, text, text, integer, text, timestamptz, jsonb)
  TO service_role;
