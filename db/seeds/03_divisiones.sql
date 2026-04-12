-- Seed 03: Divisiones (Capítulos) de Estándares

-- NB Bolivia: 16 capítulos
INSERT INTO divisiones (estandar_id, codigo, nombre, orden) VALUES
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-OPR', 'Obras Preliminares', 1),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-MVT', 'Movimiento de Tierras', 2),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-FUN', 'Fundaciones', 3),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-EHA', 'Estructura de Hormigón Armado', 4),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-EMT', 'Estructura Metálica', 5),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-MUR', 'Muros y Tabiques', 6),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-REV', 'Revoques y Enlucidos', 7),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-PIS', 'Pisos y Pavimentos', 8),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-CUB', 'Cubiertas', 9),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-CMA', 'Carpintería de Madera', 10),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-CME', 'Carpintería Metálica', 11),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-ISA', 'Instalaciones Sanitarias', 12),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-IEL', 'Instalaciones Eléctricas', 13),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-IGA', 'Instalaciones de Gas', 14),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-PIN', 'Pintura', 15),
((SELECT id FROM estandares WHERE codigo = 'NB'), 'NB-VID', 'Vidrios y Cristales', 16);

-- RNE Perú: 8 capítulos
INSERT INTO divisiones (estandar_id, codigo, nombre, orden) VALUES
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-E.020', 'Cargas, Análisis y Combinaciones de Carga', 1),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-E.030', 'Concreto Armado', 2),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-E.050', 'Estructuras de Acero', 3),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-E.060', 'Madera', 4),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-IS.010', 'Instalaciones Sanitarias', 5),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-IE.010', 'Instalaciones Eléctricas', 6),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-A.040', 'Exigencias de Señalización', 7),
((SELECT id FROM estandares WHERE codigo = 'RNE'), 'RNE-A.070', 'Sótanos', 8);

-- CSI US MasterFormat: 8 divisiones
INSERT INTO divisiones (estandar_id, codigo, nombre, orden) VALUES
((SELECT id FROM estandares WHERE codigo = 'CSI'), 'CSI-03', 'Concrete', 1),
((SELECT id FROM estandares WHERE codigo = 'CSI'), 'CSI-04', 'Masonry', 2),
((SELECT id FROM estandares WHERE codigo = 'CSI'), 'CSI-05', 'Metals', 3),
((SELECT id FROM estandares WHERE codigo = 'CSI'), 'CSI-06', 'Wood, Plastics, and Composites', 4),
((SELECT id FROM estandares WHERE codigo = 'CSI'), 'CSI-07', 'Thermal and Moisture Protection', 5),
((SELECT id FROM estandares WHERE codigo = 'CSI'), 'CSI-08', 'Openings, Penetrations, and Closures', 6),
((SELECT id FROM estandares WHERE codigo = 'CSI'), 'CSI-09', 'Finishes', 7),
((SELECT id FROM estandares WHERE codigo = 'CSI'), 'CSI-22', 'Plumbing and Gas and Hydronic Piping', 8);

-- ABNT Brasil: 5 capítulos
INSERT INTO divisiones (estandar_id, codigo, nombre, orden) VALUES
((SELECT id FROM estandares WHERE codigo = 'ABNT'), 'ABNT-NBR-6118', 'Projeto de Estruturas de Concreto', 1),
((SELECT id FROM estandares WHERE codigo = 'ABNT'), 'ABNT-NBR-8800', 'Projeto de Estruturas de Aço', 2),
((SELECT id FROM estandares WHERE codigo = 'ABNT'), 'ABNT-NBR-7190', 'Projeto de Estruturas de Madeira', 3),
((SELECT id FROM estandares WHERE codigo = 'ABNT'), 'ABNT-NBR-13969', 'Instalações Hidraulicas Internas', 4),
((SELECT id FROM estandares WHERE codigo = 'ABNT'), 'ABNT-NBR-5410', 'Instalações Elétricas em Baixa Tensão', 5);

-- CIRSOC Argentina: 5 capítulos
INSERT INTO divisiones (estandar_id, codigo, nombre, orden) VALUES
((SELECT id FROM estandares WHERE codigo = 'CIRSOC'), 'CIRSOC-201', 'Reglamento Argentino de Estructuras de Hormigón', 1),
((SELECT id FROM estandares WHERE codigo = 'CIRSOC'), 'CIRSOC-301', 'Reglamento Argentino de Estructuras de Acero', 2),
((SELECT id FROM estandares WHERE codigo = 'CIRSOC'), 'CIRSOC-601', 'Reglamento Argentino de Estructuras de Madera', 3),
((SELECT id FROM estandares WHERE codigo = 'CIRSOC'), 'CIRSOC-103', 'Reglamento Argentino para Cargas y Sobrecargas', 4),
((SELECT id FROM estandares WHERE codigo = 'CIRSOC'), 'CIRSOC-105', 'Reglamento Argentino de Cargas Sísmicas', 5);

-- NCh Chile: 5 capítulos
INSERT INTO divisiones (estandar_id, codigo, nombre, orden) VALUES
((SELECT id FROM estandares WHERE codigo = 'NCh'), 'NCh-430', 'Hormigón Armado - Requisitos de Diseño y Cálculo', 1),
((SELECT id FROM estandares WHERE codigo = 'NCh'), 'NCh-1198', 'Madera - Construcciones en Madera - Cálculo', 2),
((SELECT id FROM estandares WHERE codigo = 'NCh'), 'NCh-427', 'Acero - Estructuras de Acero - Cálculo', 3),
((SELECT id FROM estandares WHERE codigo = 'NCh'), 'NCh-2369', 'Diseño Sísmico de Edificios', 4),
((SELECT id FROM estandares WHERE codigo = 'NCh'), 'NCh-1970', 'Instalaciones Sanitarias Interior de Edificios', 5);
