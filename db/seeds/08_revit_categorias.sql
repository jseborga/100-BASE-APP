-- 08_revit_categorias.sql
-- Revit 2025 Categories for BIM integration
-- Inserted: 12 categories with Spanish names and key parameters

INSERT INTO revit_categorias (id, nombre, nombre_es, parametros_clave, created_at) VALUES
  (gen_random_uuid(), 'Walls', 'Muros', '["Area", "Volume", "Width", "Height", "Length"]'::jsonb, now()),
  (gen_random_uuid(), 'Structural Columns', 'Columnas Estructurales', '["Volume", "Length", "Height"]'::jsonb, now()),
  (gen_random_uuid(), 'Structural Framing', 'Vigas Estructurales', '["Volume", "Length", "Cut Length"]'::jsonb, now()),
  (gen_random_uuid(), 'Floors', 'Pisos/Losas', '["Area", "Volume", "Thickness", "Perimeter"]'::jsonb, now()),
  (gen_random_uuid(), 'Ceilings', 'Cielo Raso', '["Area", "Perimeter"]'::jsonb, now()),
  (gen_random_uuid(), 'Roofs', 'Cubiertas', '["Area", "Volume", "Slope"]'::jsonb, now()),
  (gen_random_uuid(), 'Doors', 'Puertas', '["Width", "Height", "Count"]'::jsonb, now()),
  (gen_random_uuid(), 'Windows', 'Ventanas', '["Width", "Height", "Area", "Count"]'::jsonb, now()),
  (gen_random_uuid(), 'Stairs', 'Escaleras', '["Area", "Actual Number of Risers", "Actual Tread Depth"]'::jsonb, now()),
  (gen_random_uuid(), 'Railings', 'Barandas', '["Length", "Top Rail Height"]'::jsonb, now()),
  (gen_random_uuid(), 'Plumbing Fixtures', 'Aparatos Sanitarios', '["Count"]'::jsonb, now()),
  (gen_random_uuid(), 'Electrical Fixtures', 'Aparatos Eléctricos', '["Count"]'::jsonb, now());