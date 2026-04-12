-- Migration: LLM API Keys per user
-- Run this in Supabase SQL Editor if not already created

CREATE TABLE IF NOT EXISTS llm_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL,  -- 'openai', 'anthropic', 'gemini', 'openrouter', 'huggingface'
  api_key_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted
  iv TEXT NOT NULL,                -- initialization vector
  label VARCHAR(100),             -- friendly name eg 'Mi key OpenRouter'
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE llm_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own keys" ON llm_api_keys
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_llm_api_keys_updated_at
  BEFORE UPDATE ON llm_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
