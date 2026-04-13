-- 13_mapeos_derivados_muros.sql
-- Wall-derived mapeos with condicion_filtro for 1:N mapping
-- These use enriched parameters from the Revit Add-in:
--   AreaNetaInt, AreaNetaExt, HasRevoqueInt, HasRevoqueExt,
--   HasPinturaInt, HasPinturaExt, HasCeramica, HasRasgo, HasDintel,
--   RasgoTotalM2, DintelTotalML, AlfeizarTotalML, CeramicaAltura, Length, Espesor
--
-- Prioridad 10+ to not interfere with legacy mapeos (prioridad 1-5)

DO $$
DECLARE
  v_cat_walls uuid;
  -- Existing partidas
  v_part_revoque_int uuid;
  v_part_revoque_ext uuid;
  v_part_pintura_int uuid;
  v_part_pintura_ext uuid;
  v_part_piso_ceramico uuid;
  -- New partidas for wall derivatives (created below if not exist)
  v_part_ceramica_muro uuid;
  v_part_rasgo uuid;
  v_part_dintel uuid;
  v_part_alfeizar uuid;
  v_part_zocalo uuid;
BEGIN

  -- Lookup Walls category
  SELECT id INTO v_cat_walls FROM revit_categorias WHERE nombre = 'Walls';
  IF v_cat_walls IS NULL THEN
    RAISE NOTICE 'Walls category not found, skipping';
    RETURN;
  END IF;

  -- Lookup existing partidas
  SELECT id INTO v_part_revoque_int FROM partidas WHERE nombre = 'Revoque interior de yeso';
  SELECT id INTO v_part_revoque_ext FROM partidas WHERE nombre = 'Revoque exterior de cemento';
  SELECT id INTO v_part_pintura_int FROM partidas WHERE nombre = 'Pintura látex interior 2 manos';
  -- Try multiple names for exterior paint
  SELECT id INTO v_part_pintura_ext FROM partidas
    WHERE nombre ILIKE '%pintura%exterior%' OR nombre ILIKE '%latex%exterior%'
    LIMIT 1;
  SELECT id INTO v_part_piso_ceramico FROM partidas WHERE nombre = 'Piso cerámico';

  -- Create wall-specific derived partidas if they don't exist
  -- Ceramica de muro (zocalo ceramico)
  SELECT id INTO v_part_ceramica_muro FROM partidas WHERE nombre = 'Cerámica de muro';
  IF v_part_ceramica_muro IS NULL THEN
    INSERT INTO partidas (nombre, descripcion, unidad, tipo, capitulo, es_compuesta)
    VALUES ('Cerámica de muro', 'Revestimiento cerámico en muros hasta altura especificada', 'm2', 'obra', 'Revestimientos', false)
    RETURNING id INTO v_part_ceramica_muro;
  END IF;

  -- Rasgo interior de aberturas
  SELECT id INTO v_part_rasgo FROM partidas WHERE nombre ILIKE '%rasgo%';
  IF v_part_rasgo IS NULL THEN
    INSERT INTO partidas (nombre, descripcion, unidad, tipo, capitulo, es_compuesta)
    VALUES ('Rasgo interior de aberturas', 'Revoque de jambas y dintel en vanos de puertas y ventanas', 'm2', 'obra', 'Revoques y Enlucidos', false)
    RETURNING id INTO v_part_rasgo;
  END IF;

  -- Dintel de HoAo
  SELECT id INTO v_part_dintel FROM partidas WHERE nombre ILIKE '%dintel%';
  IF v_part_dintel IS NULL THEN
    INSERT INTO partidas (nombre, descripcion, unidad, tipo, capitulo, es_compuesta)
    VALUES ('Dintel de HºAº', 'Dintel de hormigon armado sobre aberturas de puertas y ventanas', 'ml', 'obra', 'Estructura', false)
    RETURNING id INTO v_part_dintel;
  END IF;

  -- Alfeizar de ceramica
  SELECT id INTO v_part_alfeizar FROM partidas WHERE nombre ILIKE '%alfeizar%' OR nombre ILIKE '%alféizar%';
  IF v_part_alfeizar IS NULL THEN
    INSERT INTO partidas (nombre, descripcion, unidad, tipo, capitulo, es_compuesta)
    VALUES ('Alféizar de cerámica', 'Alfeizar ceramico en base de ventanas', 'ml', 'obra', 'Revestimientos', false)
    RETURNING id INTO v_part_alfeizar;
  END IF;

  -- Zocalo ceramico
  SELECT id INTO v_part_zocalo FROM partidas WHERE nombre ILIKE '%zocalo%' OR nombre ILIKE '%zócalo%';
  IF v_part_zocalo IS NULL THEN
    INSERT INTO partidas (nombre, descripcion, unidad, tipo, capitulo, es_compuesta)
    VALUES ('Zócalo cerámico', 'Zocalo ceramico perimetral en base de muros', 'ml', 'obra', 'Revestimientos', false)
    RETURNING id INTO v_part_zocalo;
  END IF;

  -- ============================================================
  -- Insert wall-derived mapeos with condicion_filtro
  -- These use enriched params from the Revit Add-in serializer
  -- ============================================================

  -- Revoque interior (only if wall has RevEspInt > 0)
  IF v_part_revoque_int IS NOT NULL THEN
    INSERT INTO revit_mapeos (revit_categoria_id, partida_id, formula, parametro_principal, descripcion, instrucciones_computo, condicion_filtro, prioridad)
    VALUES (v_cat_walls, v_part_revoque_int, 'AreaNetaInt * 1.05', 'Area',
      'Revoque interior: area neta interior con factor desperdicio 5%',
      'Se mide el area neta interior del muro (descontando aberturas >= 0.50 m2). Factor 1.05 por desperdicios y remates.',
      'HasRevoqueInt', 10);
  END IF;

  -- Revoque exterior (only if wall has RevEspExt > 0)
  IF v_part_revoque_ext IS NOT NULL THEN
    INSERT INTO revit_mapeos (revit_categoria_id, partida_id, formula, parametro_principal, descripcion, instrucciones_computo, condicion_filtro, prioridad)
    VALUES (v_cat_walls, v_part_revoque_ext, 'AreaNetaExt * 1.05', 'Area',
      'Revoque exterior: area neta exterior con factor desperdicio 5%',
      'Se mide el area neta exterior del muro (descontando aberturas >= 0.50 m2). Factor 1.05 por desperdicios.',
      'HasRevoqueExt', 11);
  END IF;

  -- Pintura interior (only if PinturaTipoInt != NINGUNO, minus ceramic zone)
  IF v_part_pintura_int IS NOT NULL THEN
    INSERT INTO revit_mapeos (revit_categoria_id, partida_id, formula, parametro_principal, descripcion, instrucciones_computo, condicion_filtro, prioridad)
    VALUES (v_cat_walls, v_part_pintura_int, '(AreaNetaInt - Length * CeramicaAltura) * 1.05', 'Area',
      'Pintura interior: area neta menos zona ceramica, factor 5%',
      'Se descuenta la franja ceramica (longitud x altura ceramica) del area neta interior. Si no hay ceramica, CeramicaAltura=0 y se pinta toda el area.',
      'HasPinturaInt', 12);
  END IF;

  -- Pintura exterior (if exists)
  IF v_part_pintura_ext IS NOT NULL THEN
    INSERT INTO revit_mapeos (revit_categoria_id, partida_id, formula, parametro_principal, descripcion, instrucciones_computo, condicion_filtro, prioridad)
    VALUES (v_cat_walls, v_part_pintura_ext, 'AreaNetaExt * 1.05', 'Area',
      'Pintura exterior: area neta exterior con factor 5%',
      'Area neta exterior completa. Factor 1.05 por desperdicios y remates.',
      'HasPinturaExt', 13);
  END IF;

  -- Ceramica de muro (only if CeramicaAltura > 0)
  IF v_part_ceramica_muro IS NOT NULL THEN
    INSERT INTO revit_mapeos (revit_categoria_id, partida_id, formula, parametro_principal, descripcion, instrucciones_computo, condicion_filtro, prioridad)
    VALUES (v_cat_walls, v_part_ceramica_muro, 'Length * CeramicaAltura * 1.05', 'Area',
      'Ceramica: longitud muro x altura ceramica, factor 5%',
      'Se calcula como longitud neta del muro por la altura de ceramica especificada en parametros SSA. Tipicamente 1.80m en banos, 1.20m en cocinas.',
      'HasCeramica', 14);
  END IF;

  -- Rasgo interior (only if ConsiderarRasgo, pre-computed from openings)
  IF v_part_rasgo IS NOT NULL THEN
    INSERT INTO revit_mapeos (revit_categoria_id, partida_id, formula, parametro_principal, descripcion, instrucciones_computo, condicion_filtro, prioridad)
    VALUES (v_cat_walls, v_part_rasgo, 'RasgoTotalM2', 'Area',
      'Rasgo: perimetro de aberturas x espesor muro (pre-computado)',
      'El Add-in Revit pre-calcula RasgoTotalM2 = sum(2*alto + ancho) * espesor_muro para todas las aberturas hospedadas en este tipo de muro. Incluye 3 lados (jambas + dintel, no piso).',
      'HasRasgo', 15);
  END IF;

  -- Dintel HoAo (only if ConsiderarDintel, lineal pre-computed)
  IF v_part_dintel IS NOT NULL THEN
    INSERT INTO revit_mapeos (revit_categoria_id, partida_id, formula, parametro_principal, descripcion, instrucciones_computo, condicion_filtro, prioridad)
    VALUES (v_cat_walls, v_part_dintel, 'DintelTotalML', 'Length',
      'Dintel: suma de anchos de aberturas (metros lineales)',
      'El Add-in Revit pre-calcula DintelTotalML = sum(ancho) de todas las puertas y ventanas hospedadas en este tipo de muro. Cada abertura requiere un dintel de su ancho + apoyos.',
      'HasDintel', 16);
  END IF;

  -- Alfeizar ceramica (only if has ceramic + windows)
  IF v_part_alfeizar IS NOT NULL THEN
    INSERT INTO revit_mapeos (revit_categoria_id, partida_id, formula, parametro_principal, descripcion, instrucciones_computo, condicion_filtro, prioridad)
    VALUES (v_cat_walls, v_part_alfeizar, 'AlfeizarTotalML', 'Length',
      'Alfeizar: suma de anchos de ventanas (metros lineales)',
      'El Add-in Revit pre-calcula AlfeizarTotalML = sum(ancho) de ventanas hospedadas. Solo ventanas, no puertas. El alfeizar se coloca en la base de la ventana.',
      'HasCeramica', 17);
  END IF;

  -- Zocalo (along wall base)
  IF v_part_zocalo IS NOT NULL THEN
    INSERT INTO revit_mapeos (revit_categoria_id, partida_id, formula, parametro_principal, descripcion, instrucciones_computo, condicion_filtro, prioridad)
    VALUES (v_cat_walls, v_part_zocalo, 'Length', 'Length',
      'Zocalo: longitud total del muro',
      'Se mide la longitud total del muro como metros lineales de zocalo perimetral. No se descuentan aberturas que llegan al piso.',
      'HasBuna', 18);
  END IF;

  RAISE NOTICE 'Wall-derived mapeos inserted successfully';

END $$;
