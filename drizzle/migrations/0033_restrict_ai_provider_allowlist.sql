-- Keep the database provider allowlist aligned with the supported runtime.
-- Gemini is intentionally excluded; Cloudy uses Groq first with OpenAI/OpenRouter
-- as configured fallbacks.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.ai_provider_secrets
    WHERE provider NOT IN ('groq', 'openai', 'openrouter')
  ) THEN
    RAISE EXCEPTION 'Unsupported AI provider exists; review provider rows before applying allowlist';
  END IF;
END $$;

ALTER TABLE public.ai_provider_secrets
  DROP CONSTRAINT IF EXISTS ai_provider_secrets_provider_check;

ALTER TABLE public.ai_provider_secrets
  ADD CONSTRAINT ai_provider_secrets_provider_check
  CHECK (provider IN ('groq', 'openai', 'openrouter'));
