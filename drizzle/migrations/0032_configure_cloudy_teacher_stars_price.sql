-- Configure the already-approved 30-day Cloudy Teacher Telegram Stars price.
-- Guard the update so a changed plan cannot be silently repriced.
UPDATE public.subscription_plans
SET telegram_stars_amount = 300,
    updated_at = now()
WHERE code = 'cloudy_teacher'
  AND is_active = true
  AND currency = 'USD'
  AND price_minor = 400
  AND billing_interval = 'month'
  AND interval_count = 1
  AND (telegram_stars_amount IS NULL OR telegram_stars_amount = 300);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_plans
    WHERE code = 'cloudy_teacher'
      AND is_active = true
      AND telegram_stars_amount = 300
      AND currency = 'USD'
      AND price_minor = 400
      AND billing_interval = 'month'
      AND interval_count = 1
  ) THEN
    RAISE EXCEPTION 'Cloudy Teacher plan missing or incompatible; Stars price not configured';
  END IF;
END $$;
