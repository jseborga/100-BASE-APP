# base-app — ConstructionOS
> Plataforma de estandarización de metrados para construcción · LATAM · BIM-driven

---

## 🎯 Misión del sistema

**ConstructionOS no es un software de APUs.** Es un motor de estandarización de metrados que:
1. Mantiene un catálogo master de partidas de construcción por país y normativa
2. Permite componer planillas de metrados para proyectos específicos (asistido por IA)
3. Mapea elementos BIM de Revit 2025 a partidas automáticamente via Add-in C#
4. Exporta planillas estandarizadas a Odoo, S10, Excel u otro software APU

**El APU lo hace quien quiera en su herramienta. Nosotros estandarizamos el input.**

---

## 🏗 Arquitectura — decisiones tomadas

### Principio central
- Catálogo master → composición dinámica por proyecto → exportación
- Las partidas son agnósticas al país. La localización (código, norma, referencia) es una capa separada
- Los proyectos nunca duplican partidas — solo referencian el catálogo via `proyecto_partidas`

### Stack tecnológico
```
Next.js 15 (TypeScript)     ← frontend + API Routes (un solo servicio)
Supabase self-hosted         ← PostgreSQL 17 + Auth + Storage + Realtime
n8n                          ← automatización y puente con Odoo
Anthropic SDK                ← 6 agentes IA especializados
Tailwind CSS + shadcn/ui     ← componentes UI
TanStack Query               ← estado del servidor
Zod                          ← validación de payloads (crítico para Add-in Revit)
```

### Infraestructura EasyPanel
```
Proyecto "odoo-bolivia"      ← separado, ya existe
  └── odoo + odoo-db

Proyecto "base-app"          ← este repo
  ├── supabase (stack completo docker-compose oficial)
  ├── next-app (Dockerfile)
  └── n8n
```

### Deploy automático
- Repo GitHub: `jseborga/100-BASE-APP` (privado, branch `main`)
- EasyPanel proyecto `base`, servicio `app` → auto-deploy en cada `git push`
- URL producción: `https://base-app.q8waob.easypanel.host`
- Supabase: `https://base-supabase.q8waob.easypanel.host`

---

## 🗄 Base de datos — schema Supabase

### Grupos de tablas (15 tablas, orden de ejecución):
```
1. paises              → BO, PE, BR, US, AR, CL, CO, EC, PY, UY, MX
2. estandares          → NB, RNE, ABNT, CSI MasterFormat, CIRSOC, NCh
3. divisiones          → capítulos de cada estándar
4. tags                → vocabulario IA (70 tags en 7 dimensiones)
5. partidas            → catálogo master (~111 Bolivia, crece hacia 2000+)
6. partida_tags        → N:M catálogo ↔ tags (707 rows Bolivia)
7. partida_localizaciones → código local por normativa por partida
8. revit_categorias    → 12 categorías Revit 2025
9. revit_mapeos        → categoría → partida con fórmula de metrado
10. proyectos          → instancias de uso del catálogo
11. proyecto_partidas  → composición dinámica (proyecto + partida + metrado)
12. proyecto_miembros  → multiusuario con roles
13. bim_importaciones  → historial de exports de Revit
14. bim_elementos      → elementos individuales del modelo BIM
15. partida_sugerencias → cola de nuevas partidas via IA
```

### Seeds ejecutados (db/seeds/):
- `01_paises.sql` — 11 países LATAM + EEUU
- `02_estandares.sql` — NB (BO), RNE (PE), ABNT (BR), CSI (US), CIRSOC (AR), NCh (CL)
- `03_divisiones.sql` — 47 capítulos por estándar
- `04_tags.sql` — 70 tags en 7 dimensiones
- `05_partidas_bo.sql` — 111 partidas Bolivia (Edificio Multifamiliar)
- `06_partida_tags_bo.sql` — 707 relaciones partida↔tag
- `07_partida_localizaciones_bo.sql` — 111 localizaciones NB (Bolivia)
- `08_revit_categorias.sql` — 12 categorías Revit 2025
- `09_revit_mapeos.sql` — mapeos categoría Revit → partida
- `10_divisiones_pe.sql` — 17 divisiones de presupuesto RNE (Perú)
- `11_partida_localizaciones_pe.sql` — 111 localizaciones RNE (Perú)
- `12_partida_tags_pe.sql` — tags PE para las 111 partidas compartidas

### Estado de seeds por país:
- ✅ Bolivia — completo (16 capítulos, 126 partidas base + 15 especializadas via MCP, 707 tags)
- ✅ Perú — completo (17 divisiones, 111 localizaciones RNE, tags PE)
- ⏳ Brasil, Argentina, Chile, EEUU — pendiente

---

## 🏷 Sistema de tags (vocabulario del agente IA)

Tabla `tags` con columnas: `id`, `dimension`, `valor`, `descripcion`.

7 dimensiones, de más transversal a más particular:
```
1. tipo_proyecto   → residencial_multifamiliar, remodelacion_comercial, civil_vial...
2. fase            → preliminares, estructura, acabados_interiores, instalaciones_sanitarias...
3. frecuencia      → muy_comun, comun, especial, raro
4. especialidad    → esp_civil, esp_estructuras, esp_arquitectura, esp_sanitarias...
5. pais            → BO, PE, BR, US, AR, CL, universal
6. region          → altura_sobre_3500m, sismico_alto, tropical_amazonica...
7. origen_bim      → revit_mapped, formula_area, formula_volume, solo_manual
```

El agente filtra: `tipo_proyecto + fase + frecuencia → sugerencia ordenada de partidas`

---

## 🤖 Los 6 agentes IA

Cada agente = llamada a Claude API con system prompt especializado.
El contexto compartido en cada llamada: `{pais, tipologia, proyecto, normativa}`.

```
1. Orquestador     → coordina, prioriza, sintetiza
2. Normativa       → NB · RNE · ABNT · CSI · cita artículos exactos
3. Metrados        → cantidades, volúmenes, interpreta BIM
4. Partidas APU    → desglose materiales + MO + equipos + subcontratos
5. Presupuesto     → CD + GG + utilidad + impuestos por país
6. BIM/Revit       → categorías Revit 2025 → partidas, Add-in C# API
```

---

## 🏗 Mapeo Revit 2025

Tabla `revit_categorias` + `revit_mapeos` (con `formula`, `parametro_principal`, `prioridad`).

12 categorías activas con fórmulas de metrado:
```
Walls              → Area · muros, tarrajeo, pintura
Structural Columns → Volume/Length · concreto, encofrado, acero
Structural Framing → Volume · vigas, encofrado, acero
Floors             → Area · losa, piso, contrapiso
Ceilings           → Area · cielo raso, pintura
Roofs              → Area · impermeabilización, cobertura
Doors              → Count · puertas, marcos
Windows            → Area/Count · ventanas, vidrios
Stairs             → Area · escaleras, pasamanos
Railings           → Length · barandas
Plumbing Fixtures  → Count · aparatos sanitarios, tuberías
Electrical Fixtures→ Count · salidas, tableros
```

Fórmulas ejemplo:
- `Walls → tarrajeo interior`: `(Area - OpeningsArea) * 1.05`
- `Structural Columns → acero`: `Volume * 78.5` (kg/m³ promedio)
- `Floors → ladrillo losa`: `Area / 0.09` (unidades por m²)

---

## 🔗 Integraciones

### Revit Add-in (C# — componente desktop separado)
- Extrae familias/tipos/parámetros del modelo
- POST JSON a `/api/bim/import` (Next.js API Route)
- Recibe write-back de códigos de partida como parámetros compartidos

### Odoo Bolivia (vía n8n, nunca conexión DB directa)
- ConstructionOS exporta planilla JSON confirmada
- n8n recibe webhook → llama API Odoo → crea líneas de presupuesto
- Odoo puede devolver precios de insumos → ConstructionOS los muestra como referencia

### Supabase MCP (Claude Code)
- Permite queries directas a la BD desde Claude Code
- Útil para verificar seeds, correr migraciones, inspeccionar datos

### ConstructionOS MCP Server (Claude Code / Claude Desktop)
- Servidor MCP propio en `constructionos-mcp-server/`
- Conecta via webhook a `/api/webhooks/mcp` (auth: Bearer WEBHOOK_API_KEY)
- 18 tools: list_projects, get_project, search_catalog, add_partidas_to_project, bulk_create_partidas, etc.
- Permite crear partidas, asignarlas a proyectos, actualizar metrados y agregar localizaciones desde Claude
- Config en `.mcp.json` (CONSTRUCTIONOS_API_KEY debe coincidir con WEBHOOK_API_KEY en EasyPanel)

---

## 📁 Estructura del repo (actual en GitHub)

```
100-BASE-APP/
├── CLAUDE.md                    ← este archivo
├── .gitignore
├── Dockerfile                   ← Next.js standalone build (multi-stage)
├── next.config.ts               ← output: 'standalone', ignoreBuildErrors: true (temporal)
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── db/
│   ├── schema.sql               ← CREATE TABLE completo (15 tablas)
│   ├── seeds/                   ← 12 seeds (BO + PE completos)
│   │   ├── 01-06               ← Bolivia: países, estándares, divisiones, tags, partidas
│   │   ├── 07-09               ← Localizaciones BO, Revit categorías, mapeos
│   │   └── 10-12               ← Peru: divisiones RNE, localizaciones, tags PE
│   └── migrations/              ← cambios al schema (004_provider_models)
├── src/
│   ├── app/
│   │   ├── page.tsx             ← redirect('/dashboard')
│   │   ├── layout.tsx           ← root layout
│   │   ├── dashboard/
│   │   │   ├── proyectos/       ← CRUD + detalle [id] con metrados inline
│   │   │   ├── catalogo/        ← browser partidas, filtros, import a proyecto
│   │   │   ├── agentes/         ← chat IA full-height + sidebar agentes
│   │   │   └── configuracion/   ← API keys, modelos, config agentes
│   │   ├── (auth)/login/        ← login con Supabase Auth
│   │   └── api/
│   │       ├── agentes/[agente] ← POST: streaming SSE
│   │       ├── proyectos/       ← CRUD + [id]/partidas (import, patch, delete)
│   │       ├── config/          ← agentes, llm (keys, models, provider-models)
│   │       ├── webhooks/mcp/    ← POST: entry point MCP server (18 actions)
│   │       └── health/          ← GET: healthcheck
│   ├── components/
│   │   ├── layout/              ← sidebar.tsx, topbar.tsx
│   │   ├── agentes/             ← chat-agente.tsx (markdown, streaming)
│   │   └── ui/                  ← shadcn components
│   └── lib/
│       ├── supabase/            ← client.ts, server.ts
│       ├── anthropic/           ← agents.ts (registry, prompts)
│       ├── llm/                 ← providers.ts, streamLLM multi-provider
│       ├── schemas/             ← Zod validaciones
│       └── utils.ts             ← cn() helper
├── middleware.ts                 ← auth redirect
└── README.md
```

---

## ⚡ Progreso y próximos pasos

### Completado
```
[x] 1. Crear repo GitHub "100-BASE-APP" (privado)
[x] 2. Levantar Supabase en EasyPanel (docker-compose oficial)
[x] 3. Ejecutar schema.sql en Supabase (15 tablas, 11 índices, 6 triggers, RLS)
[x] 4. Ejecutar seeds 01→06 en orden (11 países, 6 estándares, 47 div, 70 tags, 111 partidas, 707 tags)
[x] 5. Verificar datos con Supabase MCP
[x] 6. Crear proyecto Next.js 15 base con auth de Supabase (@supabase/ssr)
[x] 7. Conectar a EasyPanel con auto-deploy desde GitHub (Dockerfile multi-stage)
[x] 8. Implementar API Route /api/bim/import (con validación Zod)
[x] 9. Generar tipos TypeScript de Supabase (database.ts con 15 tablas)
```

### Completado (fase 2)
```
[x] 10. Implementar agentes IA — 6 agentes con streaming SSE, config por usuario
[x] 11. CRUD completo de proyectos — crear, editar, eliminar, cambiar estado
[x] 12. Catálogo master con filtros por estándar/país, import a proyecto
[x] 13. Agregar partidas Perú — seeds RNE (111 localizaciones + divisiones + tags)
[x] 14. Chat de agentes — full-height layout, markdown rendering, sidebar agentes
[x] 15. Configuración — API keys, modelos editables, config por agente
[x] 16. Detalle proyecto — metrado inline, quitar partidas, agrupado por capítulo
```

### Completado (fase 3)
```
[x] 17. Desactivar ignoreBuildErrors — ya está en false, 0 errores TypeScript
[x] 18. Exportar planilla (Excel, JSON) desde proyecto — ExcelJS, API /export
[x] 19. Dashboard con estadísticas reales — proyectos, catálogo, asignaciones, BIM
```

### Completado (fase 4 — MCP + catálogo expandido)
```
[x] 20. MCP Server ConstructionOS — 18 tools, webhook auth, stdio transport
[x] 21. Partidas especializadas hormigón visto — columnas, vigas, losas, encofrado metálico, resane, curado, sellador
[x] 22. Partidas terreno en pendiente — gaviones, estabilización suelo arcilloso
[x] 23. Partidas acabados especiales — piso madera entablonada, tragaluz/claraboya, ventana aluminio termopanel
[x] 24. Catálogo expandido de 111 → 126 partidas con localizaciones NB (Bolivia)
```

### Pendiente (orden)
```
[ ] 25. Conectar n8n para exportación a Odoo
[ ] 26. Implementar modo importación Excel
[ ] 27. Agregar partidas Brasil (ABNT localizaciones)
```

---

## 🔑 Variables de entorno necesarias

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Webhook MCP
WEBHOOK_API_KEY=              # ← auth para /api/webhooks/mcp (misma key en .mcp.json)

# Odoo (para n8n)
ODOO_URL=
ODOO_DB=
ODOO_USER=
ODOO_PASSWORD=

# App
NEXT_PUBLIC_APP_URL=
```

---

## 📚 Librería de partidas — cómo funciona y cómo se usa

### Concepto central: catálogo vivo + composición dinámica

El sistema tiene dos capas completamente separadas:

```
CAPA 1 — Catálogo master (global, permanente)
  └── Todas las partidas posibles de construcción
  └── Agnósticas al país — "Muro ladrillo soga e=15cm"
  └── Crece con el tiempo, nunca se borra, solo se depreca

CAPA 2 — Composición de proyecto (local, dinámica)
  └── Selección específica del catálogo para UN proyecto
  └── Con metrados calculados o ingresados
  └── Referencia el catálogo, nunca lo duplica
  └── Vive en: proyecto_partidas
```

### La partida en el catálogo vs en el proyecto

```
partidas (catálogo)                    proyecto_partidas (uso)
─────────────────────                  ────────────────────────
id                                     proyecto_id → proyectos
nombre: "Muro ladrillo soga"  ←FK─    partida_id  → partidas
descripcion                            cantidad: 1
unidad: m²                             metrado_manual: 342.5
tipo: obra                             metrado_bim: null
capitulo: "Muros y Tabiques"           metrado_final: 342.5
es_compuesta: false                    notas: "Piso 1 al 6"
partida_padre_id: null                 orden: 1
```

Una partida del catálogo puede estar en 1000 proyectos distintos.
Cada proyecto tiene su propia fila en `proyecto_partidas` con su propio metrado.

### Localización por normativa (misma partida, distinto país)

Tabla `partida_localizaciones` (columnas: partida_id, estandar_id, codigo_local, referencia_norma):
```
partida: "Muro ladrillo soga e=15cm"
│
├── Bolivia (estandar: NB)
│   codigo_local: 05.01
│   referencia_norma: "NB-1225002 Art.3"
│
├── Perú (estandar: RNE)
│   codigo_local: 04.01.01
│   referencia_norma: "RNE E.070"
│
├── Brasil (estandar: ABNT)
│   codigo_local: 04.01
│   referencia_norma: "ABNT NBR 15270"
│
└── EEUU (estandar: CSI)
    codigo_local: 04 21 13
    referencia_norma: "CSI 04 20 00"
```

### Cómo el agente filtra el catálogo por proyecto

Cuando el usuario crea un proyecto, el agente recibe:
```json
{
  "tipo_proyecto": "residencial_multifamiliar",
  "pais": "BO",
  "region": "La Paz",
  "m2": 850,
  "num_pisos": 6
}
```

El agente traduce esto a tags y filtra:
```sql
SELECT p.* FROM partidas p
JOIN partida_tags pt ON p.id = pt.partida_id
JOIN tags t ON pt.tag_id = t.id
WHERE t.valor IN (
  'residencial_multifamiliar',  -- dimension: tipo_proyecto
  'BO',                          -- dimension: pais
  'altura_sobre_3500m',          -- dimension: region
  'sismico_medio'                -- dimension: region
)
GROUP BY p.id
HAVING COUNT(DISTINCT t.valor) >= 2
ORDER BY
  MAX(CASE WHEN t.valor = 'muy_comun' THEN 1 ELSE 0 END) DESC,
  MAX(CASE WHEN t.valor = 'comun'     THEN 1 ELSE 0 END) DESC
```

### Flujos de ingreso

**Modo manual** (sin BIM):
1. Usuario crea proyecto (tipo + país + región)
2. Agente sugiere partidas del catálogo (filtradas por tags)
3. Usuario confirma/quita/agrega → ingresa metrados manualmente
4. Exporta a Odoo / S10 / Excel

**Modo BIM-driven** (con Revit 2025):
1. Add-in C# extrae categoría + familia + tipo + parámetros
2. POST JSON a /api/bim/import
3. Sistema cruza con revit_mapeos → calcula metrado
4. Usuario revisa → confirma → exporta

**Modo importación Excel** (datos existentes):
1. Usuario sube Excel con: descripcion | unidad | metrado
2. Agente mapea cada fila al catálogo por similitud semántica
3. Usuario confirma → sistema normaliza → crea proyecto_partidas

---

## 📌 Principios de diseño — no cambiar sin discutir

1. **El catálogo nunca se duplica** — `proyecto_partidas` solo referencia, nunca copia
2. **Tags son el lenguaje del agente** — agregar tags antes de agregar lógica
3. **APU es de Odoo** — ConstructionOS no calcula precios, solo metrados
4. **Supabase y Odoo nunca comparten DB** — solo se comunican via API/n8n
5. **El Add-in Revit es el único componente desktop** — todo lo demás es web
6. **Nuevas partidas pasan por `partida_sugerencias`** — nunca directo al catálogo sin revisión
