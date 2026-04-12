-- Seed 04: Tags (70 tags en 7 dimensiones)

-- tipo_proyecto (8 tags)
INSERT INTO tags (dimension, valor, descripcion) VALUES
('tipo_proyecto', 'residencial_multifamiliar', 'Edificios de apartamentos para múltiples familias'),
('tipo_proyecto', 'residencial_unifamiliar', 'Casas para una sola familia'),
('tipo_proyecto', 'comercial', 'Locales comerciales, oficinas, centros comerciales'),
('tipo_proyecto', 'industrial', 'Plantas, fábricas, almacenes'),
('tipo_proyecto', 'educativo', 'Escuelas, universidades, institutos'),
('tipo_proyecto', 'salud', 'Hospitales, clínicas, centros de salud'),
('tipo_proyecto', 'civil_vial', 'Carreteras, puentes, vías'),
('tipo_proyecto', 'remodelacion_comercial', 'Rehabilitación de edificios existentes uso comercial');

-- fase (14 tags)
INSERT INTO tags (dimension, valor, descripcion) VALUES
('fase', 'preliminares', 'Demolición, excavación, desalojo, limpieza'),
('fase', 'movimiento_tierras', 'Movimiento, compactación, relleno de suelos'),
('fase', 'fundaciones', 'Cimientos, pilotes, losas de fundación'),
('fase', 'estructura', 'Elementos estructurales: columnas, vigas, muros de carga'),
('fase', 'albanileria', 'Muros divisorios, bloques, ladrillos, hormigón'),
('fase', 'revoques', 'Morteros, tarrajeo, enlucidos interiores y exteriores'),
('fase', 'pisos', 'Contrapiso, cerámica, porcelanato, madera, hormigón pulido'),
('fase', 'cubiertas', 'Techos, tejas, impermeabilización, láminas'),
('fase', 'carpinteria', 'Puertas, ventanas, marcos, molduras de madera'),
('fase', 'instalaciones_sanitarias', 'Tuberías, aparatos sanitarios, desagües, agua caliente'),
('fase', 'instalaciones_electricas', 'Alambrado, tableros, luminarias, tomacorrientes'),
('fase', 'instalaciones_gas', 'Tuberías de gas, artefactos a gas'),
('fase', 'pintura', 'Esmaltes, látex, pinturas especiales'),
('fase', 'acabados_interiores', 'Cielo raso, drywall, molduras, detalles finales interiores');

-- frecuencia (4 tags)
INSERT INTO tags (dimension, valor, descripcion) VALUES
('frecuencia', 'muy_comun', 'Aparece en >80% de proyectos'),
('frecuencia', 'comun', 'Aparece en 50-80% de proyectos'),
('frecuencia', 'especial', 'Aparece en 20-50% de proyectos'),
('frecuencia', 'raro', 'Aparece en <20% de proyectos');

-- especialidad (8 tags)
INSERT INTO tags (dimension, valor, descripcion) VALUES
('especialidad', 'esp_civil', 'Ingeniero Civil general'),
('especialidad', 'esp_estructuras', 'Especialista en análisis y diseño estructural'),
('especialidad', 'esp_arquitectura', 'Arquitecto, diseño y espacios'),
('especialidad', 'esp_sanitarias', 'Ingeniero de instalaciones sanitarias'),
('especialidad', 'esp_electricas', 'Ingeniero de instalaciones eléctricas'),
('especialidad', 'esp_gas', 'Especialista en instalaciones de gas'),
('especialidad', 'esp_mecanicas', 'Ingeniero de sistemas HVAC y climatización'),
('especialidad', 'esp_telecomunicaciones', 'Especialista en redes de datos y telecomunicaciones');

-- pais (12 tags)
INSERT INTO tags (dimension, valor, descripcion) VALUES
('pais', 'BO', 'Aplica normativa Boliviana NB'),
('pais', 'PE', 'Aplica normativa Peruana RNE'),
('pais', 'BR', 'Aplica normativa Brasileña ABNT'),
('pais', 'US', 'Aplica normativa USA CSI MasterFormat'),
('pais', 'AR', 'Aplica normativa Argentina CIRSOC'),
('pais', 'CL', 'Aplica normativa Chilena NCh'),
('pais', 'CO', 'Aplica normativa Colombiana'),
('pais', 'EC', 'Aplica normativa Ecuatoriana'),
('pais', 'PY', 'Aplica normativa Paraguaya'),
('pais', 'UY', 'Aplica normativa Uruguaya'),
('pais', 'MX', 'Aplica normativa Mexicana'),
('pais', 'universal', 'Aplica a todos los países');

-- region (8 tags)
INSERT INTO tags (dimension, valor, descripcion) VALUES
('region', 'altura_sobre_3500m', 'Altura > 3500 m.s.n.m., baja presión atmosférica'),
('region', 'sismico_alto', 'Zona con alta sismicidad, aceleraciones >0.4g'),
('region', 'sismico_moderado', 'Zona con sismicidad moderada, aceleraciones 0.2-0.4g'),
('region', 'tropical_amazonica', 'Clima tropical húmedo, alta precipitación'),
('region', 'costa_desertica', 'Clima árido/deserértico, baja precipitación'),
('region', 'templado', 'Clima templado, variaciones moderadas'),
('region', 'frio_austral', 'Clima frío, temperaturas bajo 0°C frecuente'),
('region', 'subtropical', 'Clima subtropical, temperatura y humedad moderada-alta');

-- origen_bim (6 tags)
INSERT INTO tags (dimension, valor, descripcion) VALUES
('origen_bim', 'revit_mapped', 'Extraído directamente de elemento Revit'),
('origen_bim', 'formula_area', 'Metrado calculado por área (m²)'),
('origen_bim', 'formula_volume', 'Metrado calculado por volumen (m³)'),
('origen_bim', 'formula_length', 'Metrado calculado por largo (m)'),
('origen_bim', 'formula_count', 'Metrado calculado por cantidad (unidades)'),
('origen_bim', 'solo_manual', 'Requiere ingreso manual, no mapeable a BIM');
