-- Migration: Editable model list per LLM provider
-- Allows admins/users to manage which models are available for agent configuration
-- Seeded with defaults from STATIC_MODELS; can be modified via UI

-- 1. Create table
CREATE TABLE IF NOT EXISTS provider_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,          -- 'openrouter', 'openai', 'anthropic', etc.
  model_id VARCHAR(200) NOT NULL,         -- 'google/gemini-2.0-flash', 'gpt-4o', etc.
  model_name VARCHAR(200) NOT NULL,       -- Human-readable: 'Gemini 2.0 Flash'
  context_window INT DEFAULT 0,           -- tokens
  activo BOOLEAN DEFAULT true,
  orden INT DEFAULT 0,                    -- display order within provider
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, model_id)
);

ALTER TABLE provider_models ENABLE ROW LEVEL SECURITY;

-- Everyone can read models (public config)
DROP POLICY IF EXISTS "provider_models_select" ON provider_models;
CREATE POLICY "provider_models_select" ON provider_models FOR SELECT USING (true);

-- Only authenticated users can manage (in practice, admin check in API)
DROP POLICY IF EXISTS "provider_models_insert" ON provider_models;
CREATE POLICY "provider_models_insert" ON provider_models FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "provider_models_update" ON provider_models;
CREATE POLICY "provider_models_update" ON provider_models FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "provider_models_delete" ON provider_models;
CREATE POLICY "provider_models_delete" ON provider_models FOR DELETE USING (auth.uid() IS NOT NULL);

-- 2. Seed default models (idempotent via ON CONFLICT)
INSERT INTO provider_models (provider, model_id, model_name, context_window, orden) VALUES
  -- Anthropic
  ('anthropic', 'claude-sonnet-4-20250514', 'Claude Sonnet 4', 200000, 1),
  ('anthropic', 'claude-haiku-3-5-20241022', 'Claude 3.5 Haiku', 200000, 2),
  -- OpenAI
  ('openai', 'gpt-4o', 'GPT-4o', 128000, 1),
  ('openai', 'gpt-4o-mini', 'GPT-4o Mini', 128000, 2),
  ('openai', 'gpt-4-turbo', 'GPT-4 Turbo', 128000, 3),
  ('openai', 'o1-mini', 'o1 Mini', 128000, 4),
  -- Google Gemini
  ('gemini', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 1000000, 1),
  ('gemini', 'gemini-2.5-flash-preview-04-17', 'Gemini 2.5 Flash', 1000000, 2),
  ('gemini', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 2000000, 3),
  -- HuggingFace
  ('huggingface', 'meta-llama/Llama-3.1-70B-Instruct', 'Llama 3.1 70B', 131072, 1),
  ('huggingface', 'mistralai/Mistral-7B-Instruct-v0.3', 'Mistral 7B', 32768, 2),
  ('huggingface', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen 2.5 72B', 131072, 3),
  -- OpenRouter (most popular via OpenRouter)
  ('openrouter', 'google/gemini-2.0-flash', 'Gemini 2.0 Flash', 1000000, 1),
  ('openrouter', 'google/gemini-2.5-flash-preview', 'Gemini 2.5 Flash Preview', 1000000, 2),
  ('openrouter', 'anthropic/claude-sonnet-4', 'Claude Sonnet 4', 200000, 3),
  ('openrouter', 'openai/gpt-4o-mini', 'GPT-4o Mini', 128000, 4),
  ('openrouter', 'openai/gpt-4o', 'GPT-4o', 128000, 5),
  ('openrouter', 'meta-llama/llama-3.1-70b-instruct', 'Llama 3.1 70B', 131072, 6),
  ('openrouter', 'deepseek/deepseek-chat-v3-0324', 'DeepSeek V3', 163840, 7),
  ('openrouter', 'qwen/qwen-2.5-72b-instruct', 'Qwen 2.5 72B', 131072, 8)
ON CONFLICT (provider, model_id) DO NOTHING;

-- 3. Ensure agent_config table exists (repeat from 003, idempotent)
CREATE TABLE IF NOT EXISTS agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_slug VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, agent_slug)
);

ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_config_select" ON agent_config;
CREATE POLICY "agent_config_select" ON agent_config FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "agent_config_insert" ON agent_config;
CREATE POLICY "agent_config_insert" ON agent_config FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "agent_config_update" ON agent_config;
CREATE POLICY "agent_config_update" ON agent_config FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "agent_config_delete" ON agent_config;
CREATE POLICY "agent_config_delete" ON agent_config FOR DELETE USING (user_id = auth.uid());

-- Safe trigger (only if function exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_agent_config_updated_at ON agent_config;
    CREATE TRIGGER trg_agent_config_updated_at
      BEFORE UPDATE ON agent_config
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
