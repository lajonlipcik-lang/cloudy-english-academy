-- Allow multiple Groq credentials for resilience/failover.
-- This does not create additional provider quota; organization limits remain shared.
DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.ai_provider_secrets'::regclass
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(provider)%'
  LOOP
    EXECUTE format('ALTER TABLE public.ai_provider_secrets DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS ai_provider_secrets_provider_priority_idx
  ON public.ai_provider_secrets (provider, enabled, priority);
