-- Seed 02: Estándares de Construcción por País
INSERT INTO estandares (pais_id, codigo, nombre, version) VALUES
((SELECT id FROM paises WHERE codigo = 'BO'), 'NB', 'Norma Boliviana de Construcción', 'NB-1225001'),
((SELECT id FROM paises WHERE codigo = 'PE'), 'RNE', 'Reglamento Nacional de Edificaciones', 'DS N° 011-2006'),
((SELECT id FROM paises WHERE codigo = 'BR'), 'ABNT', 'Associação Brasileira de Normas Técnicas', 'NBR Series'),
((SELECT id FROM paises WHERE codigo = 'US'), 'CSI', 'CSI MasterFormat', '2020 Edition'),
((SELECT id FROM paises WHERE codigo = 'AR'), 'CIRSOC', 'Centro de Investigación de Reglamentos de Seguridad', 'CIRSOC 2005'),
((SELECT id FROM paises WHERE codigo = 'CL'), 'NCh', 'Norma Chilena de Construcción', 'NCh Series');
