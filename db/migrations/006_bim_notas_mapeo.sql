-- Migration 006: Add mapping documentation fields to BIM tables
-- notas_mapeo: instructions on how to compute/map non-obvious elements
-- formula_usada: the formula that was applied (for audit trail)
-- These fields enable round-trip: Revit → ConstructionOS → Revit write-back

ALTER TABLE bim_elementos ADD COLUMN IF NOT EXISTS notas_mapeo TEXT;
ALTER TABLE bim_elementos ADD COLUMN IF NOT EXISTS formula_usada TEXT;
ALTER TABLE bim_elementos ADD COLUMN IF NOT EXISTS partida_codigo VARCHAR(50);
ALTER TABLE bim_elementos ADD COLUMN IF NOT EXISTS partida_nombre VARCHAR(300);

-- Add instrucciones_computo to revit_mapeos (how the AI/user decided this formula)
ALTER TABLE revit_mapeos ADD COLUMN IF NOT EXISTS instrucciones_computo TEXT;

COMMENT ON COLUMN bim_elementos.notas_mapeo IS 'Instrucciones de cómo computar/mapear este elemento. Viaja de vuelta a Revit.';
COMMENT ON COLUMN bim_elementos.formula_usada IS 'Fórmula aplicada para calcular metrado. Ej: (Area - OpeningsArea) * 1.05';
COMMENT ON COLUMN bim_elementos.partida_codigo IS 'Código local de partida asignada (para write-back a Revit)';
COMMENT ON COLUMN bim_elementos.partida_nombre IS 'Nombre de partida asignada (para write-back a Revit)';
COMMENT ON COLUMN revit_mapeos.instrucciones_computo IS 'Documentación de cómo/por qué se usa esta fórmula. Se envía a Revit como guía.';
