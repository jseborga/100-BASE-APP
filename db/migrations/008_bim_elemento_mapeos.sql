-- 008_bim_elemento_mapeos.sql
-- Junction table for N:M mapping between bim_elementos and partidas.
-- Replaces the single partida_id FK on bim_elementos for multi-mapping:
--   1:N  → one wall type maps to muro + revoque + zocalo + pintura
--   N:1  → doors + windows aggregate into dinteles

CREATE TABLE IF NOT EXISTS bim_elemento_mapeos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elemento_id UUID NOT NULL REFERENCES bim_elementos(id) ON DELETE CASCADE,
  partida_id UUID NOT NULL REFERENCES partidas(id),
  formula TEXT,
  metrado_calculado DECIMAL(15,4),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(elemento_id, partida_id)
);

CREATE INDEX IF NOT EXISTS idx_bim_elemento_mapeos_elemento ON bim_elemento_mapeos(elemento_id);
CREATE INDEX IF NOT EXISTS idx_bim_elemento_mapeos_partida ON bim_elemento_mapeos(partida_id);

-- RLS: same policy as bim_elementos (access via importacion → proyecto)
ALTER TABLE bim_elemento_mapeos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mapeos BIM por miembro" ON bim_elemento_mapeos FOR ALL TO authenticated
  USING (
    elemento_id IN (
      SELECT be.id FROM bim_elementos be
      JOIN bim_importaciones bi ON bi.id = be.importacion_id
      JOIN proyectos p ON p.id = bi.proyecto_id
      LEFT JOIN proyecto_miembros pm ON pm.proyecto_id = p.id
      WHERE p.propietario_id = auth.uid() OR pm.usuario_id = auth.uid()
    )
  );

-- Migrate existing mappings from bim_elementos.partida_id
INSERT INTO bim_elemento_mapeos (elemento_id, partida_id, formula, metrado_calculado)
SELECT
  be.id,
  be.partida_id,
  (be.parametros->>'_formula')::TEXT,
  be.metrado_calculado
FROM bim_elementos be
WHERE be.partida_id IS NOT NULL
ON CONFLICT (elemento_id, partida_id) DO NOTHING;
