-- Migration: Agent LLM configuration per user
-- Stores which provider/model each user wants for each agent

CREATE TABLE IF NOT EXISTS agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_slug VARCHAR(50) NOT NULL,  -- 'orquestador', 'normativa', etc.
  provider VARCHAR(50) NOT NULL,     -- 'openrouter', 'openai', etc.
  model VARCHAR(200) NOT NULL,       -- 'google/gemini-2.0-flash', etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, agent_slug)
);

ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_config_select" ON agent_config;
CREATE POLICY "agent_config_select" ON agent_config FOR SELECT USING (
  user_id = auth.uid()
);
DROP POLICY IF EXISTS "agent_config_insert" ON agent_config;
CREATE POLICY "agent_config_insert" ON agent_config FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
DROP POLICY IF EXISTS "agent_config_update" ON agent_config;
CREATE POLICY "agent_config_update" ON agent_config FOR UPDATE USING (
  user_id = auth.uid()
);
DROP POLICY IF EXISTS "agent_config_delete" ON agent_config;
CREATE POLICY "agent_config_delete" ON agent_config FOR DELETE USING (
  user_id = auth.uid()
);

DROP TRIGGER IF EXISTS trg_agent_config_updated_at ON agent_config;
CREATE TRIGGER trg_agent_config_updated_at
  BEFORE UPDATE ON agent_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
