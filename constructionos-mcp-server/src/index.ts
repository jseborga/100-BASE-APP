#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// ============================================================
// ConstructionOS MCP Server
// Exposes tools for AI-driven construction metrados orchestration
// Connects to the Next.js webhook API
// ============================================================

const API_URL = process.env.CONSTRUCTIONOS_API_URL || 'https://base-app.q8waob.easypanel.host'
const API_KEY = process.env.CONSTRUCTIONOS_API_KEY || ''

async function callWebhook(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const url = `${API_URL}/api/webhooks/mcp`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ action, params }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(`API error (${response.status}): ${(err as Record<string, string>).error || response.statusText}`)
  }

  return response.json()
}

// ============================================================
// Server setup
// ============================================================

const server = new McpServer({
  name: 'constructionos',
  version: '1.0.0',
})

// ============================================================
// TOOLS — Read operations
// ============================================================

server.tool(
  'list_projects',
  'List all construction projects. Returns project name, country, typology, status, area, and floor count.',
  {
    estado: z.enum(['activo', 'archivado', 'borrador']).optional().describe('Filter by project status'),
    limit: z.number().optional().describe('Max results (default 50)'),
  },
  async (params) => {
    const result = await callWebhook('list_projects', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'get_project',
  'Get full detail of a project including all assigned partidas with metrados, localizaciones, and country info. Use this to understand what a project currently contains.',
  {
    proyecto_id: z.string().uuid().describe('Project UUID'),
  },
  async (params) => {
    const result = await callWebhook('get_project', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'search_catalog',
  'Search the master partidas catalog by name, chapter, unit, or tags. Use to find existing partidas before creating new ones. The catalog is country-agnostic — localizaciones add country-specific codes.',
  {
    query: z.string().optional().describe('Search by partida name (fuzzy match)'),
    capitulo: z.string().optional().describe('Filter by chapter (e.g., "Muros y Tabiques", "Estructura")'),
    unidad: z.string().optional().describe('Filter by unit (m2, m3, ml, kg, pza, glb, m, und)'),
    pais_codigo: z.string().optional().describe('Filter to partidas that have a localizacion for this country code (BO, PE, BR, etc.)'),
    tags: z.array(z.string()).optional().describe('Filter by tag values (e.g., ["residencial_multifamiliar", "muy_comun"])'),
    limit: z.number().optional().describe('Max results (default 50)'),
    offset: z.number().optional().describe('Pagination offset'),
  },
  async (params) => {
    const result = await callWebhook('search_catalog', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'get_countries',
  'List all available countries in the system with their codes and currencies.',
  {},
  async () => {
    const result = await callWebhook('get_countries')
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'get_standards',
  'List construction standards/normativas (NB for Bolivia, RNE for Peru, ABNT for Brazil, CSI for USA, etc.). Each standard has divisions/chapters.',
  {
    pais_codigo: z.string().optional().describe('Filter by country code (BO, PE, BR, US, AR, CL)'),
  },
  async (params) => {
    const result = await callWebhook('get_standards', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'get_tags',
  'List all AI vocabulary tags used for partida filtering. Tags have 7 dimensions: tipo_proyecto, fase, frecuencia, especialidad, pais, region, origen_bim.',
  {
    dimension: z.string().optional().describe('Filter by dimension'),
  },
  async (params) => {
    const result = await callWebhook('get_tags', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'get_project_partidas',
  'Get all partidas assigned to a project with their metrados (quantities), localizaciones (country codes), and catalog detail.',
  {
    proyecto_id: z.string().uuid().describe('Project UUID'),
  },
  async (params) => {
    const result = await callWebhook('get_project_partidas', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'get_partida_detail',
  'Get full detail of a single catalog partida including all country localizaciones and assigned tags.',
  {
    partida_id: z.string().uuid().describe('Partida UUID'),
  },
  async (params) => {
    const result = await callWebhook('get_partida_detail', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

// ============================================================
// TOOLS — Write operations
// ============================================================

server.tool(
  'add_partidas_to_project',
  'Add one or more existing catalog partidas to a project. Skips duplicates. Optionally set initial metrados.',
  {
    proyecto_id: z.string().uuid().describe('Project UUID'),
    partida_ids: z.array(z.string().uuid()).describe('Array of partida UUIDs to add'),
    metrados: z.record(z.string(), z.number()).optional().describe('Optional: { partida_id: metrado_value } for initial metrado_manual'),
  },
  async (params) => {
    const result = await callWebhook('add_partidas_to_project', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'remove_partidas_from_project',
  'Remove partidas from a project (does not delete them from the catalog).',
  {
    proyecto_id: z.string().uuid().describe('Project UUID'),
    partida_ids: z.array(z.string().uuid()).describe('Array of partida UUIDs to remove'),
  },
  async (params) => {
    const result = await callWebhook('remove_partidas_from_project', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'update_metrado',
  'Update the metrado (quantity) for a specific partida within a project.',
  {
    proyecto_id: z.string().uuid().describe('Project UUID'),
    partida_id: z.string().uuid().describe('Partida UUID'),
    metrado_manual: z.number().optional().describe('Manual metrado value'),
    metrado_final: z.number().optional().describe('Final confirmed metrado'),
    notas: z.string().optional().describe('Notes about the metrado'),
  },
  async (params) => {
    const result = await callWebhook('update_metrado', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'create_partida',
  'Create a new partida in the master catalog. Use this when a needed partida does not exist yet. The partida is country-agnostic — add localizaciones separately.',
  {
    nombre: z.string().describe('Partida name (e.g., "Muro ladrillo soga e=15cm")'),
    unidad: z.string().describe('Unit of measurement (m2, m3, ml, kg, pza, glb, m, und)'),
    capitulo: z.string().optional().describe('Chapter grouping (e.g., "Muros y Tabiques", "Estructura")'),
    descripcion: z.string().optional().describe('Detailed description'),
    tipo: z.string().optional().describe('Type: obra, suministro, instalacion (default: obra)'),
  },
  async (params) => {
    const result = await callWebhook('create_partida', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'create_suggestion',
  'Submit a partida suggestion to the review queue. Use this for partidas that should be reviewed before being added to the master catalog.',
  {
    nombre_sugerido: z.string().describe('Suggested partida name'),
    unidad_sugerida: z.string().optional().describe('Suggested unit'),
    descripcion: z.string().optional().describe('Description and justification'),
    origen: z.enum(['ia', 'usuario']).optional().describe('Origin of suggestion'),
    contexto: z.record(z.string(), z.unknown()).optional().describe('Additional context (project, country, etc.)'),
  },
  async (params) => {
    const result = await callWebhook('create_suggestion', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'approve_suggestion',
  'Approve a pending partida suggestion, creating the actual partida in the master catalog.',
  {
    suggestion_id: z.string().uuid().describe('Suggestion UUID'),
  },
  async (params) => {
    const result = await callWebhook('approve_suggestion', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'add_localizacion',
  'Add or update a country-specific code (localizacion) for a partida. Each partida can have one code per standard (NB for Bolivia, RNE for Peru, etc.).',
  {
    partida_id: z.string().uuid().describe('Partida UUID'),
    estandar_codigo: z.string().describe('Standard code: NB (Bolivia), RNE (Peru), ABNT (Brazil), CSI (USA), CIRSOC (Argentina), NCh (Chile)'),
    codigo_local: z.string().describe('Local code within the standard (e.g., "05.01", "04.01.01", "04 21 13")'),
    referencia_norma: z.string().optional().describe('Normative reference (e.g., "NB-1225002 Art.3", "RNE E.070")'),
  },
  async (params) => {
    const result = await callWebhook('add_localizacion', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'add_tags_to_partida',
  'Assign AI vocabulary tags to a partida for intelligent filtering. Tags have 7 dimensions: tipo_proyecto, fase, frecuencia, especialidad, pais, region, origen_bim.',
  {
    partida_id: z.string().uuid().describe('Partida UUID'),
    tags: z.array(z.object({
      dimension: z.string().describe('Tag dimension'),
      valor: z.string().describe('Tag value'),
      peso: z.number().optional().describe('Weight/relevance (default 1.0)'),
    })).describe('Tags to assign'),
  },
  async (params) => {
    const result = await callWebhook('add_tags_to_partida', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

// ============================================================
// TOOLS — Bulk operations
// ============================================================

server.tool(
  'bulk_create_partidas',
  'Create multiple partidas at once in the master catalog. Max 100 per batch. Returns created partidas with IDs.',
  {
    partidas: z.array(z.object({
      nombre: z.string().describe('Partida name'),
      unidad: z.string().describe('Unit (m2, m3, ml, kg, pza, glb, m, und)'),
      capitulo: z.string().optional().describe('Chapter grouping'),
      descripcion: z.string().optional().describe('Description'),
    })).describe('Array of partidas to create'),
  },
  async (params) => {
    const result = await callWebhook('bulk_create_partidas', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'bulk_add_localizaciones',
  'Add country-specific codes for multiple partidas at once. Max 200 per batch. Upserts — updates existing codes.',
  {
    localizaciones: z.array(z.object({
      partida_id: z.string().uuid().describe('Partida UUID'),
      estandar_codigo: z.string().describe('Standard code (NB, RNE, ABNT, CSI, CIRSOC, NCh)'),
      codigo_local: z.string().describe('Local code'),
      referencia_norma: z.string().optional().describe('Normative reference'),
    })).describe('Array of localizaciones to add/update'),
  },
  async (params) => {
    const result = await callWebhook('bulk_add_localizaciones', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

// ============================================================
// TOOLS — BIM operations
// ============================================================

server.tool(
  'get_bim_imports',
  'List BIM imports for a project. Returns import history with element counts and status.',
  {
    proyecto_id: z.string().uuid().describe('Project UUID'),
  },
  async (params) => {
    const result = await callWebhook('get_bim_imports', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'get_bim_elements',
  'Get BIM elements for a specific import. Returns elements with Revit category, matched partida, and calculated metrado.',
  {
    importacion_id: z.string().uuid().describe('Import UUID'),
    estado: z.enum(['pendiente', 'mapeado', 'revisado', 'error']).optional().describe('Filter by element status'),
    limit: z.number().optional().describe('Max results (default 100, max 500)'),
    offset: z.number().optional().describe('Pagination offset'),
  },
  async (params) => {
    const result = await callWebhook('get_bim_elements', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'get_revit_mapeos',
  'Get Revit category → partida mapping rules. Shows formulas used to calculate metrados from BIM parameters (Area, Volume, Length, Count).',
  {
    revit_categoria_id: z.string().uuid().optional().describe('Filter by Revit category UUID'),
  },
  async (params) => {
    const result = await callWebhook('get_revit_mapeos', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'import_bim_elements',
  'Import BIM elements from Revit into a project. Creates an importacion record and inserts all elements. Auto-resolves Revit category by name (Walls, Floors, Structural Columns, etc.).',
  {
    proyecto_id: z.string().uuid().describe('Project UUID'),
    archivo_nombre: z.string().optional().describe('Source file name (default: "Revit Export")'),
    elementos: z.array(z.object({
      revit_id: z.string().describe('Revit ElementId'),
      categoria: z.string().describe('Revit category name (Walls, Floors, Structural Columns, etc.)'),
      familia: z.string().describe('Revit family name'),
      tipo: z.string().describe('Revit type name'),
      parametros: z.record(z.string(), z.number()).describe('Parameters: { Area, Volume, Length, Height, Width, Count, OpeningsArea, Perimeter, ... }'),
    })).describe('Array of BIM elements to import'),
  },
  async (params) => {
    const result = await callWebhook('import_bim_elements', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'match_bim_elements',
  'Run formula-based matching on imported BIM elements. Evaluates revit_mapeos formulas against element parameters, assigns partida_id + metrado_calculado. Creates derived elements when one Revit element maps to multiple partidas (e.g., wall → brick + plaster + paint).',
  {
    importacion_id: z.string().uuid().describe('Import UUID to process'),
  },
  async (params) => {
    const result = await callWebhook('match_bim_elements', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

server.tool(
  'confirm_bim_match',
  'Confirm matched BIM elements and create/update proyecto_partidas with metrado_bim. Aggregates metrados by partida, creates new proyecto_partidas or updates existing ones, and reorders by chapter.',
  {
    importacion_id: z.string().uuid().describe('Import UUID'),
    elemento_ids: z.array(z.string().uuid()).optional().describe('Optional: confirm only specific element UUIDs (default: all matched)'),
  },
  async (params) => {
    const result = await callWebhook('confirm_bim_match', params)
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  }
)

// ============================================================
// Start server
// ============================================================

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('ConstructionOS MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
