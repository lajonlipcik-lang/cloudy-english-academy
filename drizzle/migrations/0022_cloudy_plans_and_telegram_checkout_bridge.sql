-- Cloudy English product plans and a secure one-time bridge for the existing support bot.
-- USD pricing is authoritative; Telegram Stars amount is deliberately unset until explicitly configured.
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS telegram_stars_amount integer
  CHECK (telegram_stars_amount IS NULL OR telegram_stars_amount BETWEEN 1 AND 10000);

INSERT INTO public.subscription_plans
  (code, name, description, price_minor, currency, billing_interval, interval_count, is_active, telegram_stars_amount, entitlements)
VALUES
  ('cloudy_lite', 'Cloudy Lite 2.2', 'Бесплатный тариф с ограничениями', 0, 'USD', 'none', 1, true, NULL,
   '{"tier":"lite","version":"2.2","limits":{"ai_chat":true,"advanced_features":false}}'::jsonb),
  ('cloudy_teacher', 'Cloudy Teacher 4.4', 'Полный доступ к Cloudy English на 1 месяц', 400, 'USD', 'month', 1, true, NULL,
   '{"tier":"teacher","version":"4.4","limits":{"ai_chat":true,"advanced_features":true}}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_minor = EXCLUDED.price_minor,
  currency = EXCLUDED.currency,
  billing_interval = EXCLUDED.billing_interval,
  interval_count = EXCLUDED.interval_count,
  is_active = EXCLUDED.is_active,
  entitlements = EXCLUDED.entitlements,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.telegram_payment_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  telegram_user_id bigint,
  order_id uuid REFERENCES public.telegram_payment_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_payment_tokens_user_idx
  ON public.telegram_payment_tokens(user_id, created_at DESC);
ALTER TABLE public.telegram_payment_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_payment_tokens FROM anon, authenticated;
GRANT ALL ON public.telegram_payment_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_telegram_stars_order(
  p_token_hash text,
  p_telegram_user_id bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token public.telegram_payment_tokens%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_order public.telegram_payment_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_token FROM public.telegram_payment_tokens
   WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_token.expires_at <= now() THEN
    RAISE EXCEPTION 'Payment link is invalid or expired';
  END IF;
  IF v_token.consumed_at IS NOT NULL THEN
    IF v_token.telegram_user_id <> p_telegram_user_id OR v_token.order_id IS NULL THEN
      RAISE EXCEPTION 'Payment link already used';
    END IF;
    SELECT * INTO v_order FROM public.telegram_payment_orders WHERE id = v_token.order_id;
    IF NOT FOUND OR v_order.status NOT IN ('pending', 'active') THEN
      RAISE EXCEPTION 'Payment order is no longer available';
    END IF;
  ELSE
    SELECT * INTO v_plan FROM public.subscription_plans
     WHERE id = v_token.plan_id AND is_active = true FOR SHARE;
    IF NOT FOUND OR v_plan.currency <> 'USD' OR v_plan.price_minor <> 400
       OR v_plan.billing_interval <> 'month' OR v_plan.interval_count <> 1
       OR v_plan.telegram_stars_amount IS NULL THEN
      RAISE EXCEPTION 'Cloudy Teacher Telegram Stars price is not configured';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.subscriptions s
       WHERE s.user_id = v_token.user_id
         AND s.status IN ('active', 'trialing', 'canceled')
         AND (s.current_period_end IS NULL OR s.current_period_end > now())
    ) THEN RAISE EXCEPTION 'Account already has active access'; END IF;
    UPDATE public.telegram_payment_orders
       SET status = 'expired', updated_at = now()
     WHERE user_id = v_token.user_id AND status = 'pending' AND expires_at <= now();
    IF EXISTS (SELECT 1 FROM public.telegram_payment_orders
                WHERE user_id = v_token.user_id AND status = 'pending') THEN
      RAISE EXCEPTION 'A pending payment order already exists';
    END IF;
    INSERT INTO public.telegram_payment_orders (
      user_id, plan_id, invoice_payload, telegram_user_id, telegram_chat_id,
      amount_stars, subscription_period_seconds, status, expires_at
    ) VALUES (
      v_token.user_id, v_token.plan_id, 'cs_' || replace(gen_random_uuid()::text, '-', ''),
      p_telegram_user_id, p_telegram_user_id, v_plan.telegram_stars_amount,
      2592000, 'pending', now() + interval '15 minutes'
    ) RETURNING * INTO v_order;
    UPDATE public.telegram_payment_tokens
       SET consumed_at = now(), telegram_user_id = p_telegram_user_id, order_id = v_order.id
     WHERE id = v_token.id;
  END IF;
  RETURN jsonb_build_object(
    'order_id', v_order.invoice_payload,
    'status', v_order.status,
    'amount_xtr', v_order.amount_stars,
    'title', v_plan.name,
    'description', v_plan.description,
    'subscription_period', v_order.subscription_period_seconds,
    'telegram_user_id', v_order.telegram_user_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_telegram_stars_order(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_telegram_stars_order(text, bigint) TO service_role;
