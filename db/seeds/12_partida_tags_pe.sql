-- Seed 12: Partida Tags for Peru (PE)
-- Adds the 'PE' country tag to all 111 partidas since they are reusable across Bolivia/Peru
-- This makes partidas discoverable when filtering by country = PE
-- Executed after seeds 04 (tags) and 05 (partidas)

-- Most construction partidas are shared between Bolivia and Peru
-- Only the localization (code, norma reference) differs
INSERT INTO partida_tags (id, partida_id, tag_id, peso)
SELECT
  gen_random_uuid(),
  pt.partida_id,
  (SELECT id FROM tags WHERE dimension = 'pais' AND valor = 'PE'),
  pt.peso
FROM partida_tags pt
JOIN tags t ON pt.tag_id = t.id
WHERE t.dimension = 'pais' AND t.valor = 'BO'
ON CONFLICT (partida_id, tag_id) DO NOTHING;
