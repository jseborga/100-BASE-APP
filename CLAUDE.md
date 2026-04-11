\# base-app — ConstructionOS

> Plataforma de estandarización de metrados para construcción · LATAM · BIM-driven



\---



\## 🎯 Misión del sistema



\*\*ConstructionOS no es un software de APUs.\*\* Es un motor de estandarización de metrados que:

1\. Mantiene un catálogo master de partidas de construcción por país y normativa

2\. Permite componer planillas de metrados para proyectos específicos (asistido por IA)

3\. Mapea elementos BIM de Revit 2025 a partidas automáticamente via Add-in C#

4\. Exporta planillas estandarizadas a Odoo, S10, Excel u otro software APU



\*\*El APU lo hace quien quiera en su herramienta. Nosotros estandarizamos el input.\*\*



\---



\## 🏗 Arquitectura — decisiones tomadas



\### Principio central

\- Catálogo master → composición dinámica por proyecto → exportación

\- Las partidas son agnósticas al país. La localización (código, norma, referencia) es una capa separada

\- Los proyectos nunca duplican partidas — solo referencian el catálogo via `proyecto\_partidas`



\### Stack tecnológico

```

Next.js 15 (TypeScript)     ← frontend + API Routes (un solo servicio)

Supabase self-hosted         ← PostgreSQL 17 + Auth + Storage + Realtime

n8n                          ← automatización y puente con Odoo

Anthropic SDK                ← 6 agentes IA especializados

Tailwind CSS + shadcn/ui     ← componentes UI

TanStack Query               ← estado del servidor

Zod                          ← validación de payloads (crítico para Add-in Revit)

```



\### Infraestructura EasyPanel

```

Proyecto "odoo-bolivia"      ← separado, ya existe

&#x20; └── odoo + odoo-db



Proyecto "base-app"          ← este repo

&#x20; ├── supabase (stack completo docker-compose oficial)

&#x20; ├── next-app (Dockerfile)

&#x20; └── n8n

```



\### Deploy automático

\- Repo GitHub: `base-app` (privado)

\- EasyPanel conectado al repo → auto-deploy en cada `git push`



\---



\## 🗄 Base de datos — schema Supabase



\### Grupos de tablas (9 grupos, orden de ejecución):

```

1\. paises              → BO, PE, BR, US, AR, CL, CO, EC, PY, UY

2\. estandares          → NB, RNE, ABNT, CSI MasterFormat, CIRSOC, NCh...

3\. divisiones          → capítulos de cada estándar (NB-1225001, E.060, etc.)

4\. tags                → vocabulario IA (70 tags en 7 dimensiones)

5\. partidas            → catálogo master (\~111 Bolivia, crece hacia 2000+)

6\. partida\_tags        → N:M catálogo ↔ tags (\~900 rows para Bolivia)

7\. partida\_localizaciones → código local por normativa por partida

8\. revit\_categorias    → 12 categorías Revit 2025

9\. revit\_mapeos        → categoría → partida con fórmula de metrado

10\. proyectos          → instancias de uso del catálogo

11\. proyecto\_partidas  → composición dinámica (proyecto + partida + metrado)

12\. proyecto\_miembros  → multiusuario con roles

13\. bim\_importaciones  → historial de exports de Revit

14\. bim\_elementos      → elementos individuales del modelo BIM

15\. partida\_sugerencias → cola de nuevas partidas via IA

```



\### Seeds generados (listos en db/seeds/):

\- `01\_paises.sql` — 11 países LATAM + EEUU

\- `02\_estandares.sql` — NB (BO), RNE (PE), ABNT (BR), CSI (US), CIRSOC (AR), NCh (CL)

\- `03\_divisiones.sql` — capítulos por estándar

\- `04\_tags.sql` — 70 tags en 7 dimensiones

\- `05\_partidas\_bo.sql` — 111 partidas Bolivia (Edificio Multifamiliar)

\- `06\_partida\_tags\_bo.sql` — \~900 relaciones partida↔tag



\### Estado de seeds por país:

\- ✅ Bolivia — completo (16 capítulos, 111 partidas)

\- 🔄 Perú — pendiente (70% de partidas reutilizables, cambia localización)

\- ⏳ Brasil, Argentina, Chile, EEUU — pendiente



\---



\## 🏷 Sistema de tags (vocabulario del agente IA)



7 dimensiones, de más transversal a más particular:

```

1\. tipo\_proyecto   → residencial\_multifamiliar, remodelacion\_comercial, civil\_vial...

2\. fase            → preliminares, estructura, acabados\_interiores, instalaciones\_sanitarias...

3\. frecuencia      → muy\_comun, comun, especial, raro

4\. especialidad    → esp\_civil, esp\_estructuras, esp\_arquitectura, esp\_sanitarias...

5\. pais            → BO, PE, BR, US, AR, CL, universal

6\. region          → altura\_sobre\_3500m, sismico\_alto, tropical\_amazonica...

7\. origen\_bim      → revit\_mapped, formula\_area, formula\_volume, solo\_manual

```



El agente filtra: `tipo\_proyecto + fase + frecuencia → sugerencia ordenada de partidas`



\---



\## 🤖 Los 6 agentes IA



Cada agente = llamada a Claude API con system prompt especializado.

El contexto compartido en cada llamada: `{pais, tipologia, proyecto, normativa}`.



```

1\. Orquestador     → coordina, prioriza, sintetiza

2\. Normativa       → NB · RNE · ABNT · CSI · cita artículos exactos

3\. Metrados        → cantidades, volúmenes, interpreta BIM

4\. Partidas APU    → desglose materiales + MO + equipos + subcontratos

5\. Presupuesto     → CD + GG + utilidad + impuestos por país

6\. BIM/Revit       → categorías Revit 2025 → partidas, Add-in C# API

```



\---



\## 🏗 Mapeo Revit 2025



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

\- `Walls → tarrajeo interior`: `(Area - OpeningsArea) \* 1.05`

\- `Structural Columns → acero`: `Volume \* 78.5` (kg/m³ promedio)

\- `Floors → ladrillo losa`: `Area / 0.09` (unidades por m²)



\---



\## 🔗 Integraciones



\### Revit Add-in (C# — componente desktop separado)

\- Extrae familias/tipos/parámetros del modelo

\- POST JSON a `/api/bim/import` (Next.js API Route)

\- Recibe write-back de códigos de partida como parámetros compartidos



\### Odoo Bolivia (vía n8n, nunca conexión DB directa)

\- ConstructionOS exporta planilla JSON confirmada

\- n8n recibe webhook → llama API Odoo → crea líneas de presupuesto

\- Odoo puede devolver precios de insumos → ConstructionOS los muestra como referencia



\### Supabase MCP (Claude Code)

\- Permite queries directas a la BD desde Claude Code

\- Útil para verificar seeds, correr migraciones, inspeccionar datos



\---



\## 📁 Estructura del repo



```

base-app/

├── CLAUDE.md                    ← este archivo

├── .env.example                 ← variables sin valores reales

├── .gitignore

├── docker-compose.yml           ← Supabase self-hosted (stack oficial)

├── Dockerfile                   ← Next.js app

├── db/

│   ├── schema.sql               ← CREATE TABLE completo

│   ├── seeds/

│   │   ├── 01\_paises.sql

│   │   ├── 02\_estandares.sql

│   │   ├── 03\_divisiones.sql

│   │   ├── 04\_tags.sql

│   │   ├── 05\_partidas\_bo.sql

│   │   └── 06\_partida\_tags\_bo.sql

│   └── migrations/              ← cambios futuros al schema

├── src/

│   ├── app/

│   │   ├── (dashboard)/         ← rutas protegidas

│   │   ├── api/

│   │   │   ├── bim/import/      ← recibe payload del Add-in Revit

│   │   │   ├── proyectos/       ← CRUD proyectos

│   │   │   ├── partidas/        ← búsqueda y filtrado catálogo

│   │   │   └── agentes/         ← endpoints de los 6 agentes IA

│   │   └── auth/

│   ├── components/

│   │   ├── bim-mapper/

│   │   ├── metrados/

│   │   ├── presupuesto/

│   │   ├── agentes/

│   │   └── ui/                  ← shadcn components

│   └── lib/

│       ├── supabase/            ← cliente Supabase (server + client)

│       ├── anthropic/           ← configuración agentes

│       └── schemas/             ← Zod schemas

└── README.md

```



\---



\## ⚡ Próximos pasos (orden)



```

\[ ] 1. Crear repo GitHub "base-app" (privado)

\[ ] 2. Levantar Supabase en EasyPanel (docker-compose oficial)

\[ ] 3. Ejecutar schema.sql en Supabase

\[ ] 4. Ejecutar seeds 01→06 en orden

\[ ] 5. Verificar datos con Supabase Studio

\[ ] 6. Crear proyecto Next.js base con auth de Supabase

\[ ] 7. Conectar a EasyPanel con auto-deploy desde GitHub

\[ ] 8. Implementar API Route /api/bim/import

\[ ] 9. Implementar agentes IA (empezar por Normativa y Metrados)

\[ ] 10. Agregar partidas Perú (reutilizar catálogo BO)

```



\---



\## 🔑 Variables de entorno necesarias



```env

\# Supabase

NEXT\_PUBLIC\_SUPABASE\_URL=

NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=

SUPABASE\_SERVICE\_ROLE\_KEY=



\# Anthropic

ANTHROPIC\_API\_KEY=



\# Odoo (para n8n)

ODOO\_URL=

ODOO\_DB=

ODOO\_USER=

ODOO\_PASSWORD=



\# App

NEXT\_PUBLIC\_APP\_URL=

```



\---



\## 📌 Principios de diseño — no cambiar sin discutir



1\. \*\*El catálogo nunca se duplica\*\* — `proyecto\_partidas` solo referencia, nunca copia

2\. \*\*Tags son el lenguaje del agente\*\* — agregar tags antes de agregar lógica

3\. \*\*APU es de Odoo\*\* — ConstructionOS no calcula precios, solo metrados

4\. \*\*Supabase y Odoo nunca comparten DB\*\* — solo se comunican via API/n8n

5\. \*\*El Add-in Revit es el único componente desktop\*\* — todo lo demás es web

6\. \*\*Nuevas partidas pasan por `partida\_sugerencias`\*\* — nunca directo al catálogo sin revisión

