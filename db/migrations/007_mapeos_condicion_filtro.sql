-- Migration 007: Add condicion_filtro to revit_mapeos
-- Allows filtering mapping rules by familia/tipo conditions
-- Also ensures instrucciones_computo exists (from migration 006)

ALTER TABLE revit_mapeos ADD COLUMN IF NOT EXISTS condicion_filtro TEXT;
ALTER TABLE revit_mapeos ADD COLUMN IF NOT EXISTS instrucciones_computo TEXT;

COMMENT ON COLUMN revit_mapeos.condicion_filtro IS 'Condición para aplicar la regla solo a ciertos tipos. Ej: familia contiene ladrillo';
