-- Migration: Organizations / Empresas
-- Allows grouping users, projects, and API keys by company

CREATE TABLE IF NOT EXISTS organizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE,
  plan VARCHAR(20) DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_miembros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rol VARCHAR(30) DEFAULT 'miembro',  -- admin, miembro, viewer
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Add org_id to proyectos
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizaciones(id);

-- Add org_id to llm_api_keys
ALTER TABLE llm_api_keys ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizaciones(id);

-- RLS
ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_miembros ENABLE ROW LEVEL SECURITY;

-- Helper function: get org IDs for a user (SECURITY DEFINER bypasses RLS, avoids recursion)
CREATE OR REPLACE FUNCTION get_user_org_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT org_id FROM org_miembros WHERE user_id = uid;
$$;

-- Org policies (use helper function to avoid recursion)
DROP POLICY IF EXISTS "org_select" ON organizaciones;
CREATE POLICY "org_select" ON organizaciones FOR SELECT USING (
  id IN (SELECT get_user_org_ids(auth.uid()))
);
DROP POLICY IF EXISTS "org_insert" ON organizaciones;
CREATE POLICY "org_insert" ON organizaciones FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "org_update" ON organizaciones;
CREATE POLICY "org_update" ON organizaciones FOR UPDATE USING (
  id IN (SELECT get_user_org_ids(auth.uid()))
);

-- Org members policies (NO self-reference — use direct user_id check only)
DROP POLICY IF EXISTS "org_miembros_select" ON org_miembros;
CREATE POLICY "org_miembros_select" ON org_miembros FOR SELECT USING (
  user_id = auth.uid()
  OR org_id IN (SELECT get_user_org_ids(auth.uid()))
);
DROP POLICY IF EXISTS "org_miembros_insert" ON org_miembros;
CREATE POLICY "org_miembros_insert" ON org_miembros FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- Updated proyectos policies (separate per operation)
DROP POLICY IF EXISTS "Proyectos por miembro" ON proyectos;
DROP POLICY IF EXISTS "proyectos_select" ON proyectos;
DROP POLICY IF EXISTS "proyectos_insert" ON proyectos;
DROP POLICY IF EXISTS "proyectos_update" ON proyectos;
DROP POLICY IF EXISTS "proyectos_delete" ON proyectos;

CREATE POLICY "proyectos_select" ON proyectos FOR SELECT USING (
  propietario_id = auth.uid()
  OR id IN (SELECT proyecto_id FROM proyecto_miembros WHERE usuario_id = auth.uid())
  OR org_id IN (SELECT get_user_org_ids(auth.uid()))
);
CREATE POLICY "proyectos_insert" ON proyectos FOR INSERT WITH CHECK (
  propietario_id = auth.uid()
);
CREATE POLICY "proyectos_update" ON proyectos FOR UPDATE USING (
  propietario_id = auth.uid()
) WITH CHECK (
  propietario_id = auth.uid()
);
CREATE POLICY "proyectos_delete" ON proyectos FOR DELETE USING (
  propietario_id = auth.uid()
);

-- Updated llm_api_keys policies
DROP POLICY IF EXISTS "Users manage own keys" ON llm_api_keys;
DROP POLICY IF EXISTS "llm_keys_select" ON llm_api_keys;
DROP POLICY IF EXISTS "llm_keys_insert" ON llm_api_keys;
DROP POLICY IF EXISTS "llm_keys_update" ON llm_api_keys;
DROP POLICY IF EXISTS "llm_keys_delete" ON llm_api_keys;

CREATE POLICY "llm_keys_select" ON llm_api_keys FOR SELECT USING (
  user_id = auth.uid()
  OR org_id IN (SELECT get_user_org_ids(auth.uid()))
);
CREATE POLICY "llm_keys_insert" ON llm_api_keys FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY "llm_keys_update" ON llm_api_keys FOR UPDATE USING (
  user_id = auth.uid()
);
CREATE POLICY "llm_keys_delete" ON llm_api_keys FOR DELETE USING (
  user_id = auth.uid()
);
