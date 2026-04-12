-- Migration 005: Add detail fields to proyectos for better agent context
-- area_m2: approximate total area in m2
-- num_pisos: number of floors/stories
-- These fields help the Orquestador generate better partida suggestions

ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS area_m2 DECIMAL(12,2);
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS num_pisos INTEGER;
