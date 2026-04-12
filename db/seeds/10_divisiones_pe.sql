-- Seed 10: Divisiones (Capítulos de presupuesto) — Perú RNE
-- El RNE tiene normas técnicas (E.020, E.060, etc.) pero los presupuestos
-- peruanos usan capítulos de obra similares a Bolivia.
-- Estas divisiones representan la estructura de presupuesto estándar en Perú.

-- Primero, agregar divisiones de presupuesto para RNE que mapean a los capítulos
-- de obra peruanos (compatible con S10/COSTOS)
INSERT INTO divisiones (estandar_id, codigo, nombre, orden) VALUES
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-OPP', 'Obras Provisionales y Preliminares', 10),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-MVT', 'Movimiento de Tierras', 11),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-CS',  'Concreto Simple', 12),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-CA',  'Concreto Armado', 13),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-EM',  'Estructura Metálica', 14),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-ALB', 'Albañilería', 15),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-REV', 'Revoques, Enlucidos y Molduras', 16),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-PIS', 'Pisos y Pavimentos', 17),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-ZOC', 'Zócalos y Contrazócalos', 18),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-COB', 'Coberturas', 19),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-CMA', 'Carpintería de Madera', 20),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-CME', 'Carpintería Metálica', 21),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-VID', 'Vidrios, Cristales y Similares', 22),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-PIN', 'Pintura', 23),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-ISA', 'Instalaciones Sanitarias', 24),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-IEL', 'Instalaciones Eléctricas', 25),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-IGA', 'Instalaciones de Gas', 26)
ON CONFLICT (estandar_id, codigo) DO NOTHING;
