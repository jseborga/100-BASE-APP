-- ============================================================
-- ConstructionOS — Database Schema
-- Supabase PostgreSQL 17
-- ============================================================

-- 1. PAISES
CREATE TABLE IF NOT EXISTS paises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(3) NOT NULL UNIQUE,          -- ISO 3166-1 alpha-2/3: BO, PE, BR, US
  nombre VARCHAR(100) NOT NULL,
  moneda VARCHAR(10) DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ESTANDARES (normativas por país)
CREATE TABLE IF NOT EXISTS estandares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pais_id UUID NOT NULL REFERENCES paises(id) ON DELETE CASCADE,
  codigo VARCHAR(20) NOT NULL UNIQUE,          -- NB, RNE, ABNT, CSI, CIRSOC, NCh
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  version VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. DIVISIONES (capítulos de cada estándar)
CREATE TABLE IF NOT EXISTS divisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estandar_id UUID NOT NULL REFERENCES estandares(id) ON DELETE CASCADE,
  codigo VARCHAR(30) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  orden INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(estandar_id, codigo)
);

-- 4. TAGS (vocabulario IA — 7 dimensiones)
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension VARCHAR(50) NOT NULL,              -- tipo_proyecto, fase, frecuencia, especialidad, pais, region, origen_bim
  valor VARCHAR(100) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dimension, valor)
);

-- 5. PARTIDAS (catálogo master)
CREATE TABLE IF NOT EXISTS partidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(300) NOT NULL,
  descripcion TEXT,
  unidad VARCHAR(20) NOT NULL,                 -- m2, m3, ml, kg, pza, glb, m, und
  tipo VARCHAR(50) DEFAULT 'obra',             -- obra, suministro, instalacion
  capitulo VARCHAR(100),                       -- agrupación lógica
  es_compuesta BOOLEAN DEFAULT false,
  partida_padre_id UUID REFERENCES partidas(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. PARTIDA_TAGS (N:M catálogo ↔ tags)
CREATE TABLE IF NOT EXISTS partida_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  peso FLOAT DEFAULT 1.0,                     -- relevancia del tag para esta partida
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partida_id, tag_id)
);

-- 7. PARTIDA_LOCALIZACIONES (código local por normativa)
CREATE TABLE IF NOT EXISTS partida_localizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  estandar_id UUID NOT NULL REFERENCES estandares(id) ON DELETE CASCADE,
  codigo_local VARCHAR(50) NOT NULL,           -- código según la normativa local
  referencia_norma TEXT,                       -- artículo o sección de la norma
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partida_id, estandar_id)
);

-- 8. REVIT_CATEGORIAS (categorías Revit 2025)
CREATE TABLE IF NOT EXISTS revit_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL UNIQUE,         -- Walls, Floors, Structural Columns, etc.
  nombre_es VARCHAR(100),                      -- Muros, Pisos, Columnas Estructurales
  parametros_clave JSONB DEFAULT '[]',         -- [Area, Volume, Length, Count]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. REVIT_MAPEOS (categoría → partida con fórmula)
CREATE TABLE IF NOT EXISTS revit_mapeos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revit_categoria_id UUID NOT NULL REFERENCES revit_categorias(id) ON DELETE CASCADE,
  partida_id UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  formula TEXT NOT NULL,                       -- e.g., "(Area - OpeningsArea) * 1.05"
  parametro_principal VARCHAR(50),             -- Area, Volume, Length, Count
  descripcion TEXT,
  prioridad INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. PROYECTOS
CREATE TABLE IF NOT EXISTS proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  pais_id UUID NOT NULL REFERENCES paises(id),
  tipologia VARCHAR(100),                      -- residencial_multifamiliar, comercial, etc.
  ubicacion VARCHAR(200),
  estado VARCHAR(20) DEFAULT 'activo',         -- activo, archivado, borrador
  propietario_id UUID,                         -- auth.users id
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. PROYECTO_PARTIDAS (composición dinámica)
CREATE TABLE IF NOT EXISTS proyecto_partidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  partida_id UUID NOT NULL REFERENCES partidas(id),
  cantidad DECIMAL(15,4) DEFAULT 0,
  metrado_manual DECIMAL(15,4),
  metrado_bim DECIMAL(15,4),
  metrado_final DECIMAL(15,4),
  notas TEXT,
  orden INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(proyecto_id, partida_id)
);

-- 12. PROYECTO_MIEMBROS (multiusuario con roles)
CREATE TABLE IF NOT EXISTS proyecto_miembros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,                    -- auth.users id
  rol VARCHAR(30) DEFAULT 'editor',            -- propietario, editor, visor
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(proyecto_id, usuario_id)
);

-- 13. BIM_IMPORTACIONES (historial de exports Revit)
CREATE TABLE IF NOT EXISTS bim_importaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  archivo_nombre VARCHAR(300),
  total_elementos INT DEFAULT 0,
  elementos_mapeados INT DEFAULT 0,
  estado VARCHAR(20) DEFAULT 'pendiente',      -- pendiente, procesando, completado, error
  metadata JSONB DEFAULT '{}',
  importado_por UUID,                          -- auth.users id
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. BIM_ELEMENTOS (elementos individuales del modelo)
CREATE TABLE IF NOT EXISTS bim_elementos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacion_id UUID NOT NULL REFERENCES bim_importaciones(id) ON DELETE CASCADE,
  revit_id VARCHAR(100),                       -- ElementId de Revit
  revit_categoria_id UUID REFERENCES revit_categorias(id),
  familia VARCHAR(200),
  tipo VARCHAR(200),
  parametros JSONB DEFAULT '{}',               -- Area, Volume, Length, etc.
  partida_id UUID REFERENCES partidas(id),     -- mapeo asignado
  metrado_calculado DECIMAL(15,4),
  estado VARCHAR(20) DEFAULT 'pendiente',      -- pendiente, mapeado, revisado, error
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. PARTIDA_SUGERENCIAS (cola de nuevas partidas via IA)
CREATE TABLE IF NOT EXISTS partida_sugerencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_sugerido VARCHAR(300) NOT NULL,
  unidad_sugerida VARCHAR(20),
  descripcion TEXT,
  origen VARCHAR(50) DEFAULT 'ia',             -- ia, usuario, bim
  contexto JSONB DEFAULT '{}',                 -- info del agente que la sugirió
  estado VARCHAR(20) DEFAULT 'pendiente',      -- pendiente, aprobada, rechazada
  partida_creada_id UUID REFERENCES partidas(id),
  sugerido_por UUID,                           -- auth.users id
  revisado_por UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDICES para performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_partidas_capitulo ON partidas(capitulo);
CREATE INDEX IF NOT EXISTS idx_partida_tags_partida ON partida_tags(partida_id);
CREATE INDEX IF NOT EXISTS idx_partida_tags_tag ON partida_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_partida_localizaciones_partida ON partida_localizaciones(partida_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_partidas_proyecto ON proyecto_partidas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_partidas_partida ON proyecto_partidas(partida_id);
CREATE INDEX IF NOT EXISTS idx_bim_elementos_importacion ON bim_elementos(importacion_id);
CREATE INDEX IF NOT EXISTS idx_bim_elementos_partida ON bim_elementos(partida_id);
CREATE INDEX IF NOT EXISTS idx_revit_mapeos_categoria ON revit_mapeos(revit_categoria_id);
CREATE INDEX IF NOT EXISTS idx_revit_mapeos_partida ON revit_mapeos(partida_id);
CREATE INDEX IF NOT EXISTS idx_tags_dimension ON tags(dimension);

-- ============================================================
-- TRIGGERS para updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_paises_updated_at BEFORE UPDATE ON paises FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_estandares_updated_at BEFORE UPDATE ON estandares FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_partidas_updated_at BEFORE UPDATE ON partidas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_proyectos_updated_at BEFORE UPDATE ON proyectos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_proyecto_partidas_updated_at BEFORE UPDATE ON proyecto_partidas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_partida_sugerencias_updated_at BEFORE UPDATE ON partida_sugerencias FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS (Row Level Security) — base policies
-- ============================================================

ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyecto_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE bim_importaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE bim_elementos ENABLE ROW LEVEL SECURITY;

-- Catálogo público (lectura para todos los autenticados)
ALTER TABLE paises ENABLE ROW LEVEL SECURITY;
ALTER TABLE estandares ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE partida_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE partida_localizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE revit_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE revit_mapeos ENABLE ROW LEVEL SECURITY;
ALTER TABLE partida_sugerencias ENABLE ROW LEVEL SECURITY;

-- Políticas: catálogo legible por cualquier usuario autenticado
CREATE POLICY "Catálogo público lectura" ON paises FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo público lectura" ON estandares FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo público lectura" ON divisiones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo público lectura" ON tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo público lectura" ON partidas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo público lectura" ON partida_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo público lectura" ON partida_localizaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo público lectura" ON revit_categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo público lectura" ON revit_mapeos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo público lectura" ON partida_sugerencias FOR SELECT TO authenticated USING (true);

-- Políticas: proyectos accesibles solo para miembros
CREATE POLICY "Proyectos por miembro" ON proyectos FOR ALL TO authenticated
  USING (
    propietario_id = auth.uid()
    OR id IN (SELECT proyecto_id FROM proyecto_miembros WHERE usuario_id = auth.uid())
  );

CREATE POLICY "Partidas proyecto por miembro" ON proyecto_partidas FOR ALL TO authenticated
  USING (
    proyecto_id IN (
      SELECT id FROM proyectos WHERE propietario_id = auth.uid()
      UNION
      SELECT proyecto_id FROM proyecto_miembros WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "Miembros proyecto por miembro" ON proyecto_miembros FOR ALL TO authenticated
  USING (
    proyecto_id IN (
      SELECT id FROM proyectos WHERE propietario_id = auth.uid()
      UNION
      SELECT proyecto_id FROM proyecto_miembros WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "BIM importaciones por miembro" ON bim_importaciones FOR ALL TO authenticated
  USING (
    proyecto_id IN (
      SELECT id FROM proyectos WHERE propietario_id = auth.uid()
      UNION
      SELECT proyecto_id FROM proyecto_miembros WHERE usuario_id = auth.uid()
    )
  );

CREATE POLICY "BIM elementos por miembro" ON bim_elementos FOR ALL TO authenticated
  USING (
    importacion_id IN (
      SELECT bi.id FROM bim_importaciones bi
      JOIN proyectos p ON p.id = bi.proyecto_id
      LEFT JOIN proyecto_miembros pm ON pm.proyecto_id = p.id
      WHERE p.propietario_id = auth.uid() OR pm.usuario_id = auth.uid()
    )
  );

-- Sugerencias: cualquier autenticado puede crear, solo admin puede aprobar
CREATE POLICY "Sugerencias crear" ON partida_sugerencias FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Sugerencias ver propias" ON partida_sugerencias FOR SELECT TO authenticated
  USING (sugerido_por = auth.uid() OR estado = 'aprobada');
