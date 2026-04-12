# base-app ConstructionOS

Plataforma de estandarizacion de metrados para construccion. LATAM. BIM-driven.

## Mision del sistema

ConstructionOS es un motor de estandarizacion de metrados que:
1. Mantiene un catalogo master de partidas de construccion por pais y normativa
2. Permite componer planillas de metrados para proyectos especificos (asistido por IA)
3. Mapea elementos BIM de Revit 2025 a partidas automaticamente via Add-in C#
4. Exporta planillas estandarizadas a Odoo, S10, Excel u otro software APU

## Arquitectura

### Stack tecnologico
- Next.js 15 (TypeScript) - frontend + API Routes
- Supabase self-hosted - PostgreSQL 17 + Auth + Storage + Realtime
- n8n - automatizacion y puente con Odoo
- Anthropic SDK - 6 agentes IA especializados
- Tailwind CSS + shadcn/ui - componentes UI
- TanStack Query - estado del servidor
- Zod - validacion de payloads (critico para Add-in Revit)

### Infraestructura EasyPanel
```
Proyecto "odoo-bolivia" - separado, ya existe
  └── odoo + odoo-db

Proyecto "base-app" - este repo
  ├── supabase (docker-compose oficial)
  ├── next-app (Dockerfile)
  └── n8n
```

## Base de datos

15 tablas principales:
1. paises - BO, PE, BR, US, AR, CL, CO, EC, PY, UY, MX
2. estandares - NB, RNE, ABNT, CSI, CIRSOC, NCh
3. divisiones - capitulos de cada estandar
4. tags - vocabulario IA (70 tags en 7 dimensiones)
5. partidas - catalogo master (~111 Bolivia, crece hacia 2000+)
6. partida_tags - N:M catalogo ↔ tags
7. partida_localizaciones - codigo local por normativa
8. revit_categorias - 12 categorias Revit 2025
9. revit_mapeos - categoria → partida con formula
10. proyectos - instancias de uso del catalogo
11. proyecto_partidas - composicion dinamica
12. proyecto_miembros - multiusuario con roles
13. bim_importaciones - historial de exports Revit
14. bim_elementos - elementos individuales del modelo
15. partida_sugerencias - cola de nuevas partidas via IA

## Sistema de tags

7 dimensiones, de mas transversal a mas particular:
1. tipo_proyecto - residencial_multifamiliar, remodelacion_comercial, civil_vial...
2. fase - preliminares, estructura, acabados_interiores...
3. frecuencia - muy_comun, comun, especial, raro
4. especialidad - esp_civil, esp_estructuras, esp_arquitectura...
5. pais - BO, PE, BR, US, AR, CL, universal
6. region - altura_sobre_3500m, sismico_alto, tropical_amazonica...
7. origen_bim - revit_mapped, formula_area, formula_volume, solo_manual

## Los 6 agentes IA

Cada agente = llamada a Claude API con system prompt especializado.
Contexto compartido: {pais, tipologia, proyecto, normativa}

1. Orquestador - coordina, prioriza, sintetiza
2. Normativa - NB, RNE, ABNT, CSI, cita articulos exactos
3. Metrados - cantidades, volumenes, interpreta BIM
4. Partidas APU - desglose materiales + MO + equipos
5. Presupuesto - CD + GG + utilidad + impuestos por pais
6. BIM/Revit - categorias Revit 2025 → partidas, Add-in C# API

## Mapeo Revit 2025

12 categorias activas:
- Walls → Area (muros, tarrajeo, pintura)
- Structural Columns → Volume/Length (concreto, encofrado, acero)
- Structural Framing → Volume (vigas, encofrado, acero)
- Floors → Area (losa, piso, contrapiso)
- Ceilings → Area (cielo raso, pintura)
- Roofs → Area (impermeabilizacion, cobertura)
- Doors → Count (puertas, marcos)
- Windows → Area/Count (ventanas, vidrios)
- Stairs → Area (escaleras, pasamanos)
- Railings → Length (barandas)
- Plumbing Fixtures → Count (aparatos sanitarios)
- Electrical Fixtures → Count (salidas, tableros)

## Integraciones

### Revit Add-in (C# - componente desktop separado)
- Extrae familias/tipos/parametros del modelo
- POST JSON a `/api/bim/import` (Next.js API Route)
- Recibe write-back de codigos de partida como parametros compartidos

### Odoo Bolivia (via n8n, nunca conexion DB directa)
- ConstructionOS exporta planilla JSON confirmada
- n8n recibe webhook → llama API Odoo → crea lineas de presupuesto
- Odoo puede devolver precios de insumos → ConstructionOS los muestra como referencia

### Supabase MCP (Claude Code)
- Permite queries directas a la BD desde Claude Code
- Util para verificar seeds, correr migraciones, inspeccionar datos

## Estructura del repo

```
base-app/
├── CLAUDE.md                    - este archivo
├── .env.example                 - variables sin valores reales
├── .gitignore
├── Dockerfile                   - Next.js app
├── middleware.ts                - Supabase session management
├── db/
│   ├── schema.sql               - CREATE TABLE completo
│   └── seeds/
│       ├── 01_paises.sql
│       ├── 02_estandares.sql
│       ├── 03_divisiones.sql
│       ├── 04_tags.sql
│       ├── 05_partidas_bo.sql   - 111 partidas Bolivia
│       └── 06_partida_tags_bo.sql - ~900 relaciones
├── src/
│   ├── app/
│   │   ├── (dashboard)/         - rutas protegidas
│   │   ├── (auth)/              - login layout
│   │   ├── api/
│   │   │   ├── health/
│   │   │   └── bim/import/
│   │   ├── layout.tsx
│   │   ├── page.tsx             - redirect a /dashboard
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                  - shadcn components
│   │   ├── layout/              - sidebar, topbar
│   │   └── providers.tsx
│   ├── lib/
│   │   ├── supabase/            - client, server, middleware
│   │   ├── schemas/             - Zod validation
│   │   └── utils.ts
│   └── types/
│       └── database.ts          - Supabase types
└── package.json
```

## Variables de entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Odoo (para n8n)
ODOO_URL=
ODOO_DB=
ODOO_USER=
ODOO_PASSWORD=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

## Principios de diseño

1. El catalogo nunca se duplica - `proyecto_partidas` solo referencia
2. Tags son el lenguaje del agente - agregar tags antes de agregar logica
3. APU es de Odoo - ConstructionOS no calcula precios, solo metrados
4. Supabase y Odoo nunca comparten DB - solo API/n8n
5. El Add-in Revit es el unico componente desktop - todo lo demas es web
6. Nuevas partidas pasan por `partida_sugerencias` - nunca directo al catalogo

## Proximos pasos

- [ ] 1. Crear repo GitHub "base-app" (privado) ✓
- [ ] 2. Levantar Supabase en EasyPanel (docker-compose oficial)
- [ ] 3. Ejecutar schema.sql en Supabase
- [ ] 4. Ejecutar seeds 01→06 en orden
- [ ] 5. Verificar datos con Supabase Studio
- [ ] 6. Conectar a EasyPanel con auto-deploy desde GitHub
- [ ] 7. Implementar API Route /api/bim/import
- [ ] 8. Implementar agentes IA (empezar por Normativa y Metrados)
- [ ] 9. Agregar partidas Peru (reutilizar catalogo BO)
