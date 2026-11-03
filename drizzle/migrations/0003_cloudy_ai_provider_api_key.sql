-- Cloudy AI Vault: server-only API key storage.
-- New keys are stored in api_key. Existing ciphertext/iv columns are retained
-- for backward compatibility with previously encrypted records.
CREATE TABLE IF NOT EXISTS public.ai_provider_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  label text,
  model text,
  api_key text,
  ciphertext text,
  iv text,
  key_hint text,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 10,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_tested_at timestamptz,
  last_status text
);

ALTER TABLE public.ai_provider_secrets
  ADD COLUMN IF NOT EXISTS api_key text,
  ADD COLUMN IF NOT EXISTS ciphertext text,
  ADD COLUMN IF NOT EXISTS iv text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS key_hint text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_status text;

-- Existing 0001 schema required ciphertext/iv; new plaintext-at-rest rows use api_key.
ALTER TABLE public.ai_provider_secrets
  ALTER COLUMN ciphertext DROP NOT NULL,
  ALTER COLUMN iv DROP NOT NULL;

ALTER TABLE public.ai_provider_secrets ENABLE ROW LEVEL SECURITY;

-- Remove any older authenticated/admin policies: only service_role may access the table.
DROP POLICY IF EXISTS "ai_provider_admin_select" ON public.ai_provider_secrets;
DROP POLICY IF EXISTS "ai_provider_admin_insert" ON public.ai_provider_secrets;
DROP POLICY IF EXISTS "ai_provider_admin_update" ON public.ai_provider_secrets;
DROP POLICY IF EXISTS "ai_provider_admin_delete" ON public.ai_provider_secrets;

REVOKE ALL ON TABLE public.ai_provider_secrets FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_provider_secrets TO service_role;
