-- Keep the provider allowlist aligned with Cloudy's supported runtime.
-- Gemini is intentionally excluded; Groq is primary, OpenAI/OpenRouter are fallbacks.
ALTER TABLE public.ai_provider_secrets
  DROP CONSTRAINT IF EXISTS ai_provider_secrets_provider_check;

ALTER TABLE public.ai_provider_secrets
  ADD CONSTRAINT ai_provider_secrets_provider_check
  CHECK (provider IN ('groq', 'openai', 'openrouter'));
