-- Refunds may target any historical recurring charge for the same order.
-- Do not require last_charge_id: it points only to the most recent renewal.
CREATE OR REPLACE FUNCTION public.refund_telegram_stars_payment(
  p_invoice_payload text,
  p_telegram_user_id bigint,
  p_telegram_payment_charge_id text,
  p_amount_stars integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.telegram_payment_orders%ROWTYPE;
  v_subscription_id uuid;
  v_payment_user_id uuid;
BEGIN
  SELECT * INTO v_order
    FROM public.telegram_payment_orders
   WHERE invoice_payload = p_invoice_payload
   FOR UPDATE;
  IF NOT FOUND OR v_order.telegram_user_id <> p_telegram_user_id
     OR v_order.amount_stars <> p_amount_stars THEN
    RAISE EXCEPTION 'Telegram Stars refund does not match order';
  END IF;

  SELECT user_id, subscription_id INTO v_payment_user_id, v_subscription_id
    FROM public.subscription_payments
   WHERE provider = 'telegram_stars'
     AND provider_payment_id = p_telegram_payment_charge_id
     AND status IN ('succeeded', 'refunded')
   FOR UPDATE;
  IF v_payment_user_id IS DISTINCT FROM v_order.user_id
     OR v_subscription_id IS NULL
     OR v_subscription_id IS DISTINCT FROM v_order.subscription_id THEN
    RAISE EXCEPTION 'Telegram Stars refund does not match payment';
  END IF;

  UPDATE public.subscription_payments
     SET status = 'refunded', refunded_at = coalesce(refunded_at, now())
   WHERE provider = 'telegram_stars'
     AND provider_payment_id = p_telegram_payment_charge_id
     AND user_id = v_order.user_id;

  -- Refunds revoke paid access immediately. The free plan remains available.
  UPDATE public.subscriptions
     SET status = 'expired', current_period_end = now(),
         ended_at = coalesce(ended_at, now()), updated_at = now()
   WHERE id = v_subscription_id AND user_id = v_order.user_id;

  UPDATE public.telegram_payment_orders
     SET status = 'refunded', updated_at = now()
   WHERE id = v_order.id;

  RETURN v_subscription_id;
END;
$$;
