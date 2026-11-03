CREATE TABLE IF NOT EXISTS public.ai_provider_secrets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider text NOT NULL UNIQUE CHECK(provider IN ('openai','groq','openrouter')),
 label text NOT NULL, model text NOT NULL DEFAULT '',
 ciphertext text NOT NULL, iv text NOT NULL, key_hint text NOT NULL,
 enabled boolean NOT NULL DEFAULT true, priority integer NOT NULL DEFAULT 10,
 last_tested_at timestamptz, last_status text NOT NULL DEFAULT 'untested' CHECK(last_status IN ('untested','ok','error')),
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_provider_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_provider_secrets FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_provider_secrets TO service_role;
