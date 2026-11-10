-- Allow Gemini API keys in the server-only AI provider vault.
ALTER TABLE public.ai_provider_secrets
  DROP CONSTRAINT IF EXISTS ai_provider_secrets_provider_check;

ALTER TABLE public.ai_provider_secrets
  ADD CONSTRAINT ai_provider_secrets_provider_check
  CHECK (provider IN ('openai', 'groq', 'openrouter', 'gemini'));
