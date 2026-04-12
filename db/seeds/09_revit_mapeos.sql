-- 09_revit_mapeos.sql
-- Revit Category to Partida Mappings with formulas
-- Uses DO block to dynamically look up IDs by nombre

DO $$
DECLARE
  -- Revit Categories
  v_cat_walls uuid;
  v_cat_struct_col uuid;
  v_cat_struct_frame uuid;
  v_cat_floors uuid;
  v_cat_ceilings uuid;
  v_cat_roofs uuid;
  v_cat_doors uuid;
  v_cat_windows uuid;
  v_cat_stairs uuid;
  v_cat_railings uuid;
  v_cat_plumb_fix uuid;
  v_cat_elec_fix uuid;

  -- Partidas (sample - will lookup by nombre)
  v_part_revoque_int uuid;
  v_part_revoque_ext uuid;
  v_part_pintura_latex uuid;
  v_part_muro_6h_12 uuid;
  v_part_muro_6h_18 uuid;
  v_part_col_hoao uuid;
  v_part_encofrado_col uuid;
  v_part_acero uuid;
  v_part_vigas_hoao uuid;
  v_part_encofrado_vig uuid;
  v_part_losa_aliv uuid;
  v_part_contrapiso uuid;
  v_part_piso_ceramico uuid;
  v_part_impermeab_piso uuid;
  v_part_enlucido_cielo uuid;
  v_part_impermeab_cubierta uuid;
  v_part_cubierta_calamina uuid;
  v_part_puerta_interior uuid;
  v_part_marco_madera uuid;
  v_part_ventana_aluminio uuid;
  v_part_vidrio_templado uuid;
  v_part_escaleras_hoao uuid;
  v_part_baranda_metalica uuid;
  v_part_pasamanos uuid;
  v_part_inodoro uuid;
  v_part_lavamanos uuid;
  v_part_ducha_griferia uuid;
  v_part_punto_ilum uuid;
  v_part_punto_toma uuid;
  v_part_tablero_dist uuid;

BEGIN

  -- Lookup Revit Categories by nombre
  SELECT id INTO v_cat_walls FROM revit_categorias WHERE nombre = 'Walls';
  SELECT id INTO v_cat_struct_col FROM revit_categorias WHERE nombre = 'Structural Columns';
  SELECT id INTO v_cat_struct_frame FROM revit_categorias WHERE nombre = 'Structural Framing';
  SELECT id INTO v_cat_floors FROM revit_categorias WHERE nombre = 'Floors';
  SELECT id INTO v_cat_ceilings FROM revit_categorias WHERE nombre = 'Ceilings';
  SELECT id INTO v_cat_roofs FROM revit_categorias WHERE nombre = 'Roofs';
  SELECT id INTO v_cat_doors FROM revit_categorias WHERE nombre = 'Doors';
  SELECT id INTO v_cat_windows FROM revit_categorias WHERE nombre = 'Windows';
  SELECT id INTO v_cat_stairs FROM revit_categorias WHERE nombre = 'Stairs';
  SELECT id INTO v_cat_railings FROM revit_categorias WHERE nombre = 'Railings';
  SELECT id INTO v_cat_plumb_fix FROM revit_categorias WHERE nombre = 'Plumbing Fixtures';
  SELECT id INTO v_cat_elec_fix FROM revit_categorias WHERE nombre = 'Electrical Fixtures';

  -- Lookup Partidas by nombre
  SELECT id INTO v_part_revoque_int FROM partidas WHERE nombre = 'Revoque interior de yeso';
  SELECT id INTO v_part_revoque_ext FROM partidas WHERE nombre = 'Revoque exterior de cemento';
  SELECT id INTO v_part_pintura_latex FROM partidas WHERE nombre = 'Pintura látex interior 2 manos';
  SELECT id INTO v_part_muro_6h_12 FROM partidas WHERE nombre = 'Muro de ladrillo 6 huecos e=12cm';
  SELECT id INTO v_part_muro_6h_18 FROM partidas WHERE nombre = 'Muro de ladrillo 6 huecos e=18cm';
  SELECT id INTO v_part_col_hoao FROM partidas WHERE nombre = 'Columnas de HºAº';
  SELECT id INTO v_part_encofrado_col FROM partidas WHERE nombre = 'Encofrado de columnas';
  SELECT id INTO v_part_acero FROM partidas WHERE nombre = 'Acero de refuerzo';
  SELECT id INTO v_part_vigas_hoao FROM partidas WHERE nombre = 'Vigas de HºAº';
  SELECT id INTO v_part_encofrado_vig FROM partidas WHERE nombre = 'Encofrado de vigas';
  SELECT id INTO v_part_losa_aliv FROM partidas WHERE nombre = 'Losa alivianada';
  SELECT id INTO v_part_contrapiso FROM partidas WHERE nombre = 'Contrapiso de hormigón';
  SELECT id INTO v_part_piso_ceramico FROM partidas WHERE nombre = 'Piso cerámico';
  SELECT id INTO v_part_impermeab_piso FROM partidas WHERE nombre = 'Impermeabilización de pisos';
  SELECT id INTO v_part_enlucido_cielo FROM partidas WHERE nombre = 'Enlucido de yeso en cielo raso';
  SELECT id INTO v_part_impermeab_cubierta FROM partidas WHERE nombre = 'Impermeabilización de cubierta';
  SELECT id INTO v_part_cubierta_calamina FROM partidas WHERE nombre = 'Cubierta de calamina galvanizada';
  SELECT id INTO v_part_puerta_interior FROM partidas WHERE nombre = 'Puerta interior madera';
  SELECT id INTO v_part_marco_madera FROM partidas WHERE nombre = 'Marco de madera';
  SELECT id INTO v_part_ventana_aluminio FROM partidas WHERE nombre = 'Ventana de aluminio';
  SELECT id INTO v_part_vidrio_templado FROM partidas WHERE nombre = 'Vidrio templado 6mm';
  SELECT id INTO v_part_escaleras_hoao FROM partidas WHERE nombre = 'Escaleras de HºAº';
  SELECT id INTO v_part_baranda_metalica FROM partidas WHERE nombre = 'Baranda metálica';
  SELECT id INTO v_part_pasamanos FROM partidas WHERE nombre = 'Pasamanos metálico';
  SELECT id INTO v_part_inodoro FROM partidas WHERE nombre = 'Inodoro tanque bajo';
  SELECT id INTO v_part_lavamanos FROM partidas WHERE nombre = 'Lavamanos pedestal';
  SELECT id INTO v_part_ducha_griferia FROM partidas WHERE nombre = 'Ducha con grifería';
  SELECT id INTO v_part_punto_ilum FROM partidas WHERE nombre = 'Punto de iluminación';
  SELECT id INTO v_part_punto_toma FROM partidas WHERE nombre = 'Punto de tomacorriente';
  SELECT id INTO v_part_tablero_dist FROM partidas WHERE nombre = 'Tablero de distribución';

  -- Insert Walls mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_walls, v_part_revoque_int, '(Area - OpeningsArea) * 1.05', 'Area', 'Revoque interior: área de muro menos vanos, factor 1.05', 1, now()),
    (gen_random_uuid(), v_cat_walls, v_part_revoque_ext, '(Area - OpeningsArea) * 1.05', 'Area', 'Revoque exterior: área de muro menos vanos, factor 1.05', 2, now()),
    (gen_random_uuid(), v_cat_walls, v_part_pintura_latex, '(Area - OpeningsArea) * 1.05', 'Area', 'Pintura: área de muro menos vanos, 2 manos', 3, now()),
    (gen_random_uuid(), v_cat_walls, v_part_muro_6h_12, 'Area - OpeningsArea', 'Area', 'Muro de ladrillo e=12cm: área sin vanos', 1, now()),
    (gen_random_uuid(), v_cat_walls, v_part_muro_6h_18, 'Area - OpeningsArea', 'Area', 'Muro de ladrillo e=18cm: área sin vanos', 2, now());

  -- Insert Structural Columns mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_struct_col, v_part_col_hoao, 'Volume', 'Volume', 'Hormigón en columnas: volumen directo', 1, now()),
    (gen_random_uuid(), v_cat_struct_col, v_part_encofrado_col, 'Perimeter * Height', 'Volume', 'Encofrado: perímetro por altura de columna', 2, now()),
    (gen_random_uuid(), v_cat_struct_col, v_part_acero, 'Volume * 78.5', 'Volume', 'Acero de refuerzo: volumen * 78.5 kg/m³', 3, now());

  -- Insert Structural Framing mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_struct_frame, v_part_vigas_hoao, 'Volume', 'Volume', 'Hormigón en vigas: volumen directo', 1, now()),
    (gen_random_uuid(), v_cat_struct_frame, v_part_encofrado_vig, '(Width + Height * 2) * Length', 'Volume', 'Encofrado de vigas: perímetro x largo', 2, now());

  -- Insert Floors mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_floors, v_part_losa_aliv, 'Area', 'Area', 'Losa alivianada: área sin factor', 1, now()),
    (gen_random_uuid(), v_cat_floors, v_part_contrapiso, 'Area', 'Area', 'Contrapiso de hormigón: área', 2, now()),
    (gen_random_uuid(), v_cat_floors, v_part_piso_ceramico, 'Area * 1.05', 'Area', 'Piso cerámico: área con factor 1.05 para cortes', 3, now()),
    (gen_random_uuid(), v_cat_floors, v_part_impermeab_piso, 'Area', 'Area', 'Impermeabilización: área', 4, now());

  -- Insert Ceilings mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_ceilings, v_part_enlucido_cielo, 'Area', 'Area', 'Enlucido de yeso: área de cielo raso', 1, now()),
    (gen_random_uuid(), v_cat_ceilings, v_part_pintura_latex, 'Area', 'Area', 'Pintura en cielo: área', 2, now());

  -- Insert Roofs mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_roofs, v_part_impermeab_cubierta, 'Area', 'Area', 'Impermeabilización: área de cubierta', 1, now()),
    (gen_random_uuid(), v_cat_roofs, v_part_cubierta_calamina, 'Area * 1.10', 'Area', 'Calamina: área con factor 1.10 para traslapes', 2, now());

  -- Insert Doors mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_doors, v_part_puerta_interior, 'Count', 'Count', 'Puertas: cantidad de elementos', 1, now()),
    (gen_random_uuid(), v_cat_doors, v_part_marco_madera, 'Count', 'Count', 'Marcos: cantidad de puertas', 2, now());

  -- Insert Windows mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_windows, v_part_ventana_aluminio, 'Count', 'Count', 'Ventanas: cantidad de elementos', 1, now()),
    (gen_random_uuid(), v_cat_windows, v_part_vidrio_templado, 'Width * Height', 'Area', 'Vidrio: área de ventanas', 2, now());

  -- Insert Stairs mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_stairs, v_part_escaleras_hoao, 'Count', 'Count', 'Escaleras: cantidad de tramos', 1, now());

  -- Insert Railings mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_railings, v_part_baranda_metalica, 'Length', 'Length', 'Barandas: largo total', 1, now()),
    (gen_random_uuid(), v_cat_railings, v_part_pasamanos, 'Length', 'Length', 'Pasamanos: largo total', 2, now());

  -- Insert Plumbing Fixtures mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_plumb_fix, v_part_inodoro, 'Count', 'Count', 'Inodoros: cantidad de aparatos', 1, now()),
    (gen_random_uuid(), v_cat_plumb_fix, v_part_lavamanos, 'Count', 'Count', 'Lavamanos: cantidad de aparatos', 2, now()),
    (gen_random_uuid(), v_cat_plumb_fix, v_part_ducha_griferia, 'Count', 'Count', 'Duchas: cantidad de aparatos', 3, now());

  -- Insert Electrical Fixtures mappings
  INSERT INTO revit_mapeos (id, revit_categoria_id, partida_id, formula, parametro_principal, descripcion, prioridad, created_at) VALUES
    (gen_random_uuid(), v_cat_elec_fix, v_part_punto_ilum, 'Count', 'Count', 'Puntos de iluminación: cantidad', 1, now()),
    (gen_random_uuid(), v_cat_elec_fix, v_part_punto_toma, 'Count', 'Count', 'Puntos de tomacorriente: cantidad', 2, now()),
    (gen_random_uuid(), v_cat_elec_fix, v_part_tablero_dist, 'Count', 'Count', 'Tableros: cantidad de equipos', 3, now());

END $$;