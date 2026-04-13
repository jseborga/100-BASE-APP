import { NextRequest, NextResponse } from 'next/server'
import { validateWebhookAuth, getAdmin } from '@/lib/webhooks/auth'
import { z } from 'zod'

// ============================================================
// POST /api/webhooks/mcp
// Single entry point for MCP tools. Body: { action, params }
// Auth: Bearer <WEBHOOK_API_KEY>
// ============================================================

const actionSchema = z.object({
  action: z.string().min(1),
  params: z.record(z.unknown()).optional().default({}),
})

export async function POST(request: NextRequest) {
  // Auth check
  const authError = validateWebhookAuth(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const parsed = actionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Body must include { action: string, params?: {} }', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { action, params } = parsed.data
    const handler = ACTIONS[action]

    if (!handler) {
      return NextResponse.json(
        {
          error: `Unknown action: "${action}"`,
          available_actions: Object.keys(ACTIONS),
        },
        { status: 400 }
      )
    }

    const result = await handler(params)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Webhook MCP error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

// Also support GET for listing available actions (no auth needed for discovery)
export async function GET() {
  return NextResponse.json({
    name: 'ConstructionOS MCP Webhook',
    version: '1.0',
    actions: Object.entries(ACTIONS_DOCS).map(([name, doc]) => ({
      name,
      ...doc,
    })),
  })
}

// ============================================================
// Action registry
// ============================================================

type ActionHandler = (params: Record<string, unknown>) => Promise<unknown>

const ACTIONS: Record<string, ActionHandler> = {
  // --- Read operations ---
  list_projects: handleListProjects,
  get_project: handleGetProject,
  search_catalog: handleSearchCatalog,
  get_countries: handleGetCountries,
  get_standards: handleGetStandards,
  get_tags: handleGetTags,
  get_project_partidas: handleGetProjectPartidas,
  get_partida_detail: handleGetPartidaDetail,

  // --- Write operations ---
  create_project: handleCreateProject,
  update_project: handleUpdateProject,
  add_partidas_to_project: handleAddPartidasToProject,
  remove_partidas_from_project: handleRemovePartidasFromProject,
  update_metrado: handleUpdateMetrado,
  update_partida: handleUpdatePartida,
  create_partida: handleCreatePartida,
  create_suggestion: handleCreateSuggestion,
  approve_suggestion: handleApproveSuggestion,
  add_localizacion: handleAddLocalizacion,
  add_tags_to_partida: handleAddTagsToPartida,

  // --- Bulk operations ---
  bulk_create_partidas: handleBulkCreatePartidas,
  bulk_add_localizaciones: handleBulkAddLocalizaciones,
  reorder_project_partidas: handleReorderProjectPartidas,

  // --- BIM operations ---
  get_bim_imports: handleGetBimImports,
  get_bim_elements: handleGetBimElements,
  get_bim_element_detail: handleGetBimElementDetail,
  get_revit_mapeos: handleGetRevitMapeos,
  import_bim_elements: handleImportBimElements,
  match_bim_elements: handleMatchBimElements,
  confirm_bim_match: handleConfirmBimMatch,

  // --- BIM Mapping Management (AI agent + web) ---
  create_revit_mapeo: handleCreateRevitMapeo,
  update_revit_mapeo: handleUpdateRevitMapeo,
  delete_revit_mapeo: handleDeleteRevitMapeo,
  apply_mapping_to_element: handleApplyMappingToElement,
  get_element_mappings: handleGetElementMappings,

  // --- BIM Skills (intelligent mapping per country/norm) ---
  analyze_bim_import: handleAnalyzeBimImport,
  suggest_element_mapping: handleSuggestElementMapping,
  get_mapping_coverage: handleGetMappingCoverage,
  resolve_bim_categories: handleResolveBimCategories,
}

// Documentation for GET discovery
const ACTIONS_DOCS: Record<string, { description: string; params: string }> = {
  list_projects: {
    description: 'List all projects with country info',
    params: '{ estado?: "activo"|"archivado"|"borrador", limit?: number }',
  },
  get_project: {
    description: 'Get single project with full detail and current partidas',
    params: '{ proyecto_id: string }',
  },
  search_catalog: {
    description: 'Search partidas in master catalog by name, chapter, unit, or tags',
    params: '{ query?: string, capitulo?: string, unidad?: string, pais_codigo?: string, tags?: string[], limit?: number, offset?: number }',
  },
  get_countries: {
    description: 'List all available countries',
    params: '{}',
  },
  get_standards: {
    description: 'List standards/normativas, optionally filtered by country',
    params: '{ pais_codigo?: string }',
  },
  get_tags: {
    description: 'List all tags grouped by dimension',
    params: '{ dimension?: string }',
  },
  get_project_partidas: {
    description: 'Get partidas assigned to a project with metrados and localizaciones',
    params: '{ proyecto_id: string }',
  },
  get_partida_detail: {
    description: 'Get full detail of a catalog partida including all localizaciones and tags',
    params: '{ partida_id: string }',
  },
  create_project: {
    description: 'Create a new project',
    params: '{ nombre: string, pais_id: string, ubicacion?: string, tipologia?: string, descripcion?: string, propietario_id?: string, org_id?: string }',
  },
  update_project: {
    description: 'Update project fields',
    params: '{ proyecto_id: string, nombre?: string, descripcion?: string, tipologia?: string, ubicacion?: string, estado?: string, propietario_id?: string, org_id?: string }',
  },
  add_partidas_to_project: {
    description: 'Add one or more catalog partidas to a project',
    params: '{ proyecto_id: string, partida_ids: string[], metrados?: Record<string, number> }',
  },
  remove_partidas_from_project: {
    description: 'Remove partidas from a project',
    params: '{ proyecto_id: string, partida_ids: string[] }',
  },
  update_metrado: {
    description: 'Update metrado for a partida in a project',
    params: '{ proyecto_id: string, partida_id: string, metrado_manual?: number, metrado_final?: number, notas?: string }',
  },
  update_partida: {
    description: 'Update a partida in the master catalog (name, description, unit, chapter)',
    params: '{ partida_id: string, nombre?: string, descripcion?: string, unidad?: string, capitulo?: string }',
  },
  create_partida: {
    description: 'Create a new partida in the master catalog',
    params: '{ nombre: string, unidad: string, capitulo?: string, descripcion?: string, tipo?: string }',
  },
  create_suggestion: {
    description: 'Create a partida suggestion (goes to review queue)',
    params: '{ nombre_sugerido: string, unidad_sugerida?: string, descripcion?: string, origen?: "ia"|"usuario", contexto?: {} }',
  },
  approve_suggestion: {
    description: 'Approve a pending suggestion, creating the partida in the catalog',
    params: '{ suggestion_id: string }',
  },
  add_localizacion: {
    description: 'Add or update country-specific code for a partida',
    params: '{ partida_id: string, estandar_codigo: string, codigo_local: string, referencia_norma?: string }',
  },
  add_tags_to_partida: {
    description: 'Assign tags to a partida for AI filtering',
    params: '{ partida_id: string, tags: Array<{ dimension: string, valor: string, peso?: number }> }',
  },
  bulk_create_partidas: {
    description: 'Create multiple partidas at once in the catalog',
    params: '{ partidas: Array<{ nombre: string, unidad: string, capitulo?: string, descripcion?: string }> }',
  },
  bulk_add_localizaciones: {
    description: 'Add localizaciones for multiple partidas at once',
    params: '{ localizaciones: Array<{ partida_id: string, estandar_codigo: string, codigo_local: string, referencia_norma?: string }> }',
  },
  reorder_project_partidas: {
    description: 'Reorder project partidas by logical chapter sequence. Groups partidas by chapter in construction order, sorts alphabetically within each chapter.',
    params: '{ proyecto_id: string }',
  },
  get_bim_imports: {
    description: 'List BIM imports for a project with element stats',
    params: '{ proyecto_id: string }',
  },
  get_bim_elements: {
    description: 'Get BIM elements for an import with category and partida detail',
    params: '{ importacion_id: string, estado?: "pendiente"|"mapeado"|"revisado"|"error", limit?: number, offset?: number }',
  },
  get_revit_mapeos: {
    description: 'Get Revit category → partida mapping rules with formulas',
    params: '{ revit_categoria_id?: string }',
  },
  import_bim_elements: {
    description: 'Import BIM elements from Revit. Creates importacion + elements, auto-resolves category by name.',
    params: '{ proyecto_id: string, archivo_nombre?: string, elementos: Array<{ revit_id: string, categoria: string, familia: string, tipo: string, parametros: Record<string,number> }> }',
  },
  match_bim_elements: {
    description: 'Run formula-based matching on imported BIM elements. Evaluates revit_mapeos formulas, assigns partida_id + metrado_calculado. Creates derived elements for multiple mappings per category.',
    params: '{ importacion_id: string }',
  },
  confirm_bim_match: {
    description: 'Confirm matched BIM elements, creating/updating proyecto_partidas with metrado_bim. Optionally confirm only specific elements.',
    params: '{ importacion_id: string, elemento_ids?: string[] }',
  },
  get_bim_element_detail: {
    description: 'Get full detail of a single BIM element including all numeric params, metadata, and available mapeos for its category',
    params: '{ elemento_id: string }',
  },
  create_revit_mapeo: {
    description: 'Create a new mapping rule: Revit category → partida with formula + computation instructions. Instructions travel back to Revit as COS_NOTAS_MAPEO.',
    params: '{ revit_categoria_id: string, partida_id: string, formula: string, parametro_principal?: string, descripcion?: string, instrucciones_computo?: string, prioridad?: number }',
  },
  update_revit_mapeo: {
    description: 'Update an existing mapping rule (formula, partida, priority, instructions, etc.)',
    params: '{ mapeo_id: string, formula?: string, partida_id?: string, parametro_principal?: string, descripcion?: string, instrucciones_computo?: string, prioridad?: number }',
  },
  delete_revit_mapeo: {
    description: 'Delete a mapping rule',
    params: '{ mapeo_id: string }',
  },
  apply_mapping_to_element: {
    description: 'Manually assign a partida to a BIM element with optional formula + mapping instructions. Used by AI agent to suggest/apply mappings.',
    params: '{ elemento_id: string, partida_id: string, formula?: string, metrado?: number, notas_mapeo?: string }',
  },
  get_element_mappings: {
    description: 'Get mapped element results for Revit write-back. Returns revit_id → partida code + formula + metrado + notas_mapeo (for COS_* shared params).',
    params: '{ importacion_id?: string, proyecto_id?: string }',
  },
  analyze_bim_import: {
    description: 'Analyze a BIM import: summarize elements by category, show which have mapeos and which need new rules, compare with country catalog. Returns actionable report for AI agent.',
    params: '{ importacion_id: string, pais_codigo?: string }',
  },
  suggest_element_mapping: {
    description: 'Get AI-ready mapping suggestions for a BIM element. Returns: element params, matching catalog partidas (by category + country tags), existing mapeo rules, and suggested formulas. The AI agent uses this to decide what mapping to create/apply.',
    params: '{ elemento_id: string, pais_codigo?: string }',
  },
  get_mapping_coverage: {
    description: 'Show mapping coverage statistics: how many categories have rules, which categories are missing, rules per category, per-country partida coverage. Use to identify gaps in the mapping standard.',
    params: '{ pais_codigo?: string }',
  },
  resolve_bim_categories: {
    description: 'Re-resolve revit_categoria_id for elements with null category. Uses familia name to infer Revit category (e.g., "Basic Wall"→Walls, "Floor"→Floors, "M_Concrete-Rectangular-Column"→Structural Columns).',
    params: '{ importacion_id: string }',
  },
}

// ============================================================
// Handlers
// ============================================================

async function handleListProjects(params: Record<string, unknown>) {
  const admin = getAdmin()
  const estado = (params.estado as string) || undefined
  const limit = Math.min((params.limit as number) || 50, 100)

  let query = admin
    .from('proyectos')
    .select('id, nombre, descripcion, tipologia, ubicacion, estado, created_at, paises(codigo, nombre)')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (estado) query = query.eq('estado', estado)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return { projects: data, count: data?.length || 0 }
}

async function handleCreateProject(params: Record<string, unknown>) {
  const admin = getAdmin()
  const nombre = params.nombre as string
  if (!nombre) throw new Error('nombre is required')
  const pais_id = params.pais_id as string
  if (!pais_id) throw new Error('pais_id is required (e.g. "BO")')

  // Resolve pais UUID from codigo
  const { data: pais } = await admin
    .from('paises')
    .select('id')
    .eq('codigo', pais_id)
    .single()
  if (!pais) throw new Error(`País "${pais_id}" not found`)

  const { data, error } = await admin
    .from('proyectos')
    .insert({
      nombre,
      pais_id: pais.id,
      ubicacion: (params.ubicacion as string) || null,
      tipologia: (params.tipologia as string) || null,
      descripcion: (params.descripcion as string) || null,
      propietario_id: (params.propietario_id as string) || null,
      org_id: (params.org_id as string) || null,
      estado: 'activo',
    })
    .select('id, nombre, estado')
    .single()
  if (error) throw new Error(error.message)
  return { project: data }
}

async function handleUpdateProject(params: Record<string, unknown>) {
  const admin = getAdmin()
  const id = params.proyecto_id as string
  if (!id) throw new Error('proyecto_id is required')

  const updates: Record<string, unknown> = {}
  if (params.nombre) updates.nombre = params.nombre
  if (params.descripcion !== undefined) updates.descripcion = params.descripcion
  if (params.tipologia) updates.tipologia = params.tipologia
  if (params.ubicacion) updates.ubicacion = params.ubicacion
  if (params.estado) updates.estado = params.estado
  if (params.propietario_id) updates.propietario_id = params.propietario_id
  if (params.org_id) updates.org_id = params.org_id

  if (Object.keys(updates).length === 0) throw new Error('No fields to update')

  const { data, error } = await admin
    .from('proyectos')
    .update(updates)
    .eq('id', id)
    .select('id, nombre, estado')
    .single()
  if (error) throw new Error(error.message)
  return { project: data }
}

async function handleGetProject(params: Record<string, unknown>) {
  const admin = getAdmin()
  const id = params.proyecto_id as string
  if (!id) throw new Error('proyecto_id is required')

  const { data: proyecto, error } = await admin
    .from('proyectos')
    .select('*, paises(id, codigo, nombre)')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)

  // Partidas with catalog detail + localizaciones
  const { data: partidas } = await admin
    .from('proyecto_partidas')
    .select('*, partidas(id, nombre, unidad, capitulo, descripcion, partida_localizaciones(codigo_local, referencia_norma, estandar_id, estandares(codigo, nombre)))')
    .eq('proyecto_id', id)
    .order('orden', { ascending: true })

  return { ...proyecto, partidas: partidas || [] }
}

async function handleSearchCatalog(params: Record<string, unknown>) {
  const admin = getAdmin()
  const query = params.query as string | undefined
  const capitulo = params.capitulo as string | undefined
  const unidad = params.unidad as string | undefined
  const pais_codigo = params.pais_codigo as string | undefined
  const tags = params.tags as string[] | undefined
  const limit = Math.min((params.limit as number) || 50, 200)
  const offset = (params.offset as number) || 0

  // Base query
  let q = admin
    .from('partidas')
    .select('id, nombre, unidad, capitulo, descripcion, tipo, partida_localizaciones(codigo_local, referencia_norma, estandar_id, estandares(codigo, nombre))')
    .order('capitulo', { ascending: true })
    .order('nombre', { ascending: true })
    .range(offset, offset + limit - 1)

  if (query) q = q.ilike('nombre', `%${query}%`)
  if (capitulo) q = q.eq('capitulo', capitulo)
  if (unidad) q = q.eq('unidad', unidad)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  let results = data || []

  // Filter by country localizacion if specified
  if (pais_codigo && results.length > 0) {
    results = results.filter((p: Record<string, unknown>) => {
      const locs = p.partida_localizaciones as Array<{ estandares: { codigo: string } | null }>
      return locs?.some(l => {
        const std = l.estandares as { codigo: string } | null
        return std !== null
      })
    })
  }

  // Filter by tags if specified (requires separate query)
  if (tags && tags.length > 0) {
    const { data: taggedIds } = await admin
      .from('partida_tags')
      .select('partida_id, tags(valor)')
      .in('tags.valor', tags)

    if (taggedIds) {
      const matchingIds = new Set(taggedIds.map((t: Record<string, unknown>) => t.partida_id as string))
      results = results.filter((p: Record<string, unknown>) => matchingIds.has(p.id as string))
    }
  }

  return { partidas: results, count: results.length, offset, limit }
}

async function handleGetCountries() {
  const admin = getAdmin()
  const { data, error } = await admin
    .from('paises')
    .select('id, codigo, nombre, moneda')
    .order('nombre')

  if (error) throw new Error(error.message)
  return { countries: data }
}

async function handleGetStandards(params: Record<string, unknown>) {
  const admin = getAdmin()
  const pais_codigo = params.pais_codigo as string | undefined

  let query = admin
    .from('estandares')
    .select('id, codigo, nombre, descripcion, version, paises(codigo, nombre)')
    .order('codigo')

  if (pais_codigo) {
    // Need to find pais_id first
    const { data: pais } = await admin
      .from('paises')
      .select('id')
      .eq('codigo', pais_codigo)
      .single()
    if (pais) query = query.eq('pais_id', pais.id)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return { standards: data }
}

async function handleGetTags(params: Record<string, unknown>) {
  const admin = getAdmin()
  const dimension = params.dimension as string | undefined

  let query = admin
    .from('tags')
    .select('id, dimension, valor, descripcion')
    .order('dimension')
    .order('valor')

  if (dimension) query = query.eq('dimension', dimension)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // Group by dimension
  const grouped: Record<string, typeof data> = {}
  for (const tag of data || []) {
    if (!grouped[tag.dimension]) grouped[tag.dimension] = []
    grouped[tag.dimension].push(tag)
  }

  return { tags: grouped, total: data?.length || 0 }
}

async function handleGetProjectPartidas(params: Record<string, unknown>) {
  const admin = getAdmin()
  const id = params.proyecto_id as string
  if (!id) throw new Error('proyecto_id is required')

  const { data, error } = await admin
    .from('proyecto_partidas')
    .select(`
      id, cantidad, metrado_manual, metrado_bim, metrado_final, notas, orden,
      partidas(id, nombre, unidad, capitulo, descripcion,
        partida_localizaciones(codigo_local, referencia_norma, estandares(codigo, nombre))
      )
    `)
    .eq('proyecto_id', id)
    .order('orden', { ascending: true })

  if (error) throw new Error(error.message)
  return { partidas: data || [], count: data?.length || 0 }
}

async function handleGetPartidaDetail(params: Record<string, unknown>) {
  const admin = getAdmin()
  const id = params.partida_id as string
  if (!id) throw new Error('partida_id is required')

  const { data: partida, error } = await admin
    .from('partidas')
    .select(`
      *,
      partida_localizaciones(id, codigo_local, referencia_norma, estandares(codigo, nombre)),
      partida_tags(id, peso, tags(dimension, valor, descripcion))
    `)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return partida
}

async function handleAddPartidasToProject(params: Record<string, unknown>) {
  const admin = getAdmin()
  const proyecto_id = params.proyecto_id as string
  const partida_ids = params.partida_ids as string[]
  const metrados = (params.metrados || {}) as Record<string, number>

  if (!proyecto_id) throw new Error('proyecto_id is required')
  if (!partida_ids || partida_ids.length === 0) throw new Error('partida_ids is required (array of UUIDs)')

  // Get current max order
  const { data: maxRow } = await admin
    .from('proyecto_partidas')
    .select('orden')
    .eq('proyecto_id', proyecto_id)
    .order('orden', { ascending: false })
    .limit(1)
    .single()

  let nextOrden = ((maxRow?.orden as number) ?? 0) + 1

  // Check existing to avoid duplicates
  const { data: existing } = await admin
    .from('proyecto_partidas')
    .select('partida_id')
    .eq('proyecto_id', proyecto_id)
    .in('partida_id', partida_ids)

  const existingSet = new Set((existing || []).map(e => e.partida_id))
  const toInsert = partida_ids
    .filter(pid => !existingSet.has(pid))
    .map(pid => ({
      proyecto_id,
      partida_id: pid,
      cantidad: 1,
      metrado_manual: metrados[pid] || null,
      metrado_final: metrados[pid] || null,
      orden: nextOrden++,
    }))

  if (toInsert.length === 0) {
    return { added: 0, skipped: partida_ids.length, message: 'All partidas already in project' }
  }

  const { error } = await admin
    .from('proyecto_partidas')
    .insert(toInsert)

  if (error) throw new Error(error.message)

  return {
    added: toInsert.length,
    skipped: partida_ids.length - toInsert.length,
    message: `Added ${toInsert.length} partidas to project`,
  }
}

async function handleRemovePartidasFromProject(params: Record<string, unknown>) {
  const admin = getAdmin()
  const proyecto_id = params.proyecto_id as string
  const partida_ids = params.partida_ids as string[]

  if (!proyecto_id || !partida_ids?.length) throw new Error('proyecto_id and partida_ids are required')

  const { error, count } = await admin
    .from('proyecto_partidas')
    .delete({ count: 'exact' })
    .eq('proyecto_id', proyecto_id)
    .in('partida_id', partida_ids)

  if (error) throw new Error(error.message)
  return { removed: count || 0 }
}

async function handleUpdateMetrado(params: Record<string, unknown>) {
  const admin = getAdmin()
  const proyecto_id = params.proyecto_id as string
  const partida_id = params.partida_id as string

  if (!proyecto_id || !partida_id) throw new Error('proyecto_id and partida_id are required')

  const update: Record<string, unknown> = {}
  if (params.metrado_manual !== undefined) update.metrado_manual = params.metrado_manual
  if (params.metrado_final !== undefined) update.metrado_final = params.metrado_final
  if (params.notas !== undefined) update.notas = params.notas

  if (Object.keys(update).length === 0) throw new Error('No fields to update')

  const { data, error } = await admin
    .from('proyecto_partidas')
    .update(update)
    .eq('proyecto_id', proyecto_id)
    .eq('partida_id', partida_id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

async function handleUpdatePartida(params: Record<string, unknown>) {
  const admin = getAdmin()
  const partida_id = params.partida_id as string
  if (!partida_id) throw new Error('partida_id is required')

  const update: Record<string, unknown> = {}
  if (params.nombre !== undefined) update.nombre = params.nombre
  if (params.descripcion !== undefined) update.descripcion = params.descripcion
  if (params.unidad !== undefined) update.unidad = params.unidad
  if (params.capitulo !== undefined) update.capitulo = params.capitulo

  if (Object.keys(update).length === 0) throw new Error('No fields to update')

  const { data, error } = await admin
    .from('partidas')
    .update(update)
    .eq('id', partida_id)
    .select('id, nombre, unidad, capitulo, descripcion')
    .single()

  if (error) throw new Error(error.message)
  return { partida: data, message: `Partida updated` }
}

async function handleCreatePartida(params: Record<string, unknown>) {
  const admin = getAdmin()
  const nombre = params.nombre as string
  const unidad = params.unidad as string

  if (!nombre || !unidad) throw new Error('nombre and unidad are required')

  const { data, error } = await admin
    .from('partidas')
    .insert({
      nombre,
      unidad,
      capitulo: (params.capitulo as string) || null,
      descripcion: (params.descripcion as string) || null,
      tipo: (params.tipo as string) || 'obra',
      es_compuesta: false,
    })
    .select('id, nombre, unidad, capitulo, descripcion, tipo')
    .single()

  if (error) throw new Error(error.message)

  // Log as IA suggestion auto-approved
  await admin.from('partida_sugerencias').insert({
    nombre_sugerido: nombre,
    unidad_sugerida: unidad,
    descripcion: (params.descripcion as string) || null,
    origen: 'ia',
    contexto: { source: 'mcp_webhook', capitulo: params.capitulo },
    estado: 'aprobada',
    partida_creada_id: data.id,
  })

  return { partida: data, message: `Partida "${nombre}" created` }
}

async function handleCreateSuggestion(params: Record<string, unknown>) {
  const admin = getAdmin()
  const nombre_sugerido = params.nombre_sugerido as string
  if (!nombre_sugerido) throw new Error('nombre_sugerido is required')

  const { data, error } = await admin
    .from('partida_sugerencias')
    .insert({
      nombre_sugerido,
      unidad_sugerida: (params.unidad_sugerida as string) || null,
      descripcion: (params.descripcion as string) || null,
      origen: (params.origen as string) || 'ia',
      contexto: (params.contexto as Record<string, unknown>) || { source: 'mcp_webhook' },
      estado: 'pendiente',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return { suggestion: data, message: 'Suggestion created (pending review)' }
}

async function handleApproveSuggestion(params: Record<string, unknown>) {
  const admin = getAdmin()
  const suggestion_id = params.suggestion_id as string
  if (!suggestion_id) throw new Error('suggestion_id is required')

  // Get suggestion
  const { data: sug, error: fetchErr } = await admin
    .from('partida_sugerencias')
    .select('*')
    .eq('id', suggestion_id)
    .eq('estado', 'pendiente')
    .single()

  if (fetchErr || !sug) throw new Error('Suggestion not found or already processed')

  // Create the partida
  const { data: partida, error: createErr } = await admin
    .from('partidas')
    .insert({
      nombre: sug.nombre_sugerido,
      unidad: sug.unidad_sugerida || 'glb',
      descripcion: sug.descripcion,
      tipo: 'obra',
      es_compuesta: false,
    })
    .select('id, nombre, unidad')
    .single()

  if (createErr) throw new Error(createErr.message)

  // Update suggestion
  await admin
    .from('partida_sugerencias')
    .update({ estado: 'aprobada', partida_creada_id: partida.id })
    .eq('id', suggestion_id)

  return { partida, message: `Suggestion approved, partida "${partida.nombre}" created` }
}

async function handleAddLocalizacion(params: Record<string, unknown>) {
  const admin = getAdmin()
  const partida_id = params.partida_id as string
  const estandar_codigo = params.estandar_codigo as string
  const codigo_local = params.codigo_local as string

  if (!partida_id || !estandar_codigo || !codigo_local) {
    throw new Error('partida_id, estandar_codigo, and codigo_local are required')
  }

  // Resolve estandar_id from codigo
  const { data: estandar } = await admin
    .from('estandares')
    .select('id')
    .eq('codigo', estandar_codigo)
    .single()

  if (!estandar) throw new Error(`Standard "${estandar_codigo}" not found`)

  // Upsert localizacion
  const { data, error } = await admin
    .from('partida_localizaciones')
    .upsert(
      {
        partida_id,
        estandar_id: estandar.id,
        codigo_local,
        referencia_norma: (params.referencia_norma as string) || null,
      },
      { onConflict: 'partida_id,estandar_id' }
    )
    .select()
    .single()

  if (error) throw new Error(error.message)
  return { localizacion: data, message: `Localizacion ${estandar_codigo}:${codigo_local} set for partida` }
}

async function handleAddTagsToPartida(params: Record<string, unknown>) {
  const admin = getAdmin()
  const partida_id = params.partida_id as string
  const tags = params.tags as Array<{ dimension: string; valor: string; peso?: number }>

  if (!partida_id || !tags?.length) throw new Error('partida_id and tags are required')

  let added = 0
  for (const tag of tags) {
    // Find or skip tag
    const { data: existingTag } = await admin
      .from('tags')
      .select('id')
      .eq('dimension', tag.dimension)
      .eq('valor', tag.valor)
      .single()

    if (!existingTag) continue

    const { error } = await admin
      .from('partida_tags')
      .upsert(
        { partida_id, tag_id: existingTag.id, peso: tag.peso || 1.0 },
        { onConflict: 'partida_id,tag_id' }
      )

    if (!error) added++
  }

  return { added, total_requested: tags.length }
}

async function handleBulkCreatePartidas(params: Record<string, unknown>) {
  const admin = getAdmin()
  const partidas = params.partidas as Array<{
    nombre: string; unidad: string; capitulo?: string; descripcion?: string
  }>

  if (!partidas?.length) throw new Error('partidas array is required')
  if (partidas.length > 100) throw new Error('Maximum 100 partidas per batch')

  const rows = partidas.map(p => ({
    nombre: p.nombre,
    unidad: p.unidad,
    capitulo: p.capitulo || null,
    descripcion: p.descripcion || null,
    tipo: 'obra' as const,
    es_compuesta: false,
  }))

  const { data, error } = await admin
    .from('partidas')
    .insert(rows)
    .select('id, nombre, unidad, capitulo')

  if (error) throw new Error(error.message)
  return { created: data?.length || 0, partidas: data }
}

async function handleBulkAddLocalizaciones(params: Record<string, unknown>) {
  const admin = getAdmin()
  const localizaciones = params.localizaciones as Array<{
    partida_id: string; estandar_codigo: string; codigo_local: string; referencia_norma?: string
  }>

  if (!localizaciones?.length) throw new Error('localizaciones array is required')
  if (localizaciones.length > 200) throw new Error('Maximum 200 localizaciones per batch')

  // Resolve all estandar codes to IDs
  const codigos = [...new Set(localizaciones.map(l => l.estandar_codigo))]
  const { data: estandares } = await admin
    .from('estandares')
    .select('id, codigo')
    .in('codigo', codigos)

  const estandarMap = new Map((estandares || []).map(e => [e.codigo, e.id]))

  const rows = localizaciones
    .filter(l => estandarMap.has(l.estandar_codigo))
    .map(l => ({
      partida_id: l.partida_id,
      estandar_id: estandarMap.get(l.estandar_codigo)!,
      codigo_local: l.codigo_local,
      referencia_norma: l.referencia_norma || null,
    }))

  if (rows.length === 0) throw new Error('No valid estandar codes found')

  const { error } = await admin
    .from('partida_localizaciones')
    .upsert(rows, { onConflict: 'partida_id,estandar_id' })

  if (error) throw new Error(error.message)
  return { processed: rows.length, skipped: localizaciones.length - rows.length }
}

// Logical chapter order for construction projects
const CHAPTER_ORDER = [
  'Obras Preliminares',
  'Movimiento de Tierras',
  'Fundaciones',
  'Estructura de Hormigón Armado',
  'Estructura Metálica',
  'Muros y Tabiques',
  'Revoques y Enlucidos',
  'Pisos y Pavimentos',
  'Cubiertas',
  'Carpintería de Madera',
  'Carpintería Metálica',
  'Pintura',
  'Vidrios y Cristales',
  'Instalaciones Sanitarias',
  'Instalaciones Eléctricas',
  'Instalaciones de Gas',
]

async function handleReorderProjectPartidas(params: Record<string, unknown>) {
  const admin = getAdmin()
  const proyecto_id = params.proyecto_id as string
  if (!proyecto_id) throw new Error('proyecto_id is required')

  // Get all project partidas with catalog detail
  const { data: partidas, error } = await admin
    .from('proyecto_partidas')
    .select('id, orden, partida_id, partidas(nombre, capitulo)')
    .eq('proyecto_id', proyecto_id)

  if (error) throw new Error(error.message)
  if (!partidas || partidas.length === 0) return { reordered: 0, message: 'No partidas found' }

  // Helper to extract nested partida fields
  const getCap = (p: unknown): string => {
    const obj = p as { capitulo?: string } | null
    return obj?.capitulo || ''
  }
  const getName = (p: unknown): string => {
    const obj = p as { nombre?: string } | null
    return obj?.nombre || ''
  }

  // Sort: by chapter order, then alphabetically within chapter
  const sorted = partidas.sort((a, b) => {
    const capA = getCap(a.partidas)
    const capB = getCap(b.partidas)
    const idxA = CHAPTER_ORDER.indexOf(capA)
    const idxB = CHAPTER_ORDER.indexOf(capB)
    const orderA = idxA === -1 ? 999 : idxA
    const orderB = idxB === -1 ? 999 : idxB
    if (orderA !== orderB) return orderA - orderB
    return getName(a.partidas).localeCompare(getName(b.partidas), 'es')
  })

  // Update orden for each partida
  let updated = 0
  for (let i = 0; i < sorted.length; i++) {
    const newOrden = i + 1
    if (sorted[i].orden !== newOrden) {
      await admin
        .from('proyecto_partidas')
        .update({ orden: newOrden })
        .eq('id', sorted[i].id)
      updated++
    }
  }

  // Build summary by chapter
  const summary: Record<string, number> = {}
  for (const p of sorted) {
    const cap = getCap(p.partidas) || 'Sin capítulo'
    summary[cap] = (summary[cap] || 0) + 1
  }

  return {
    reordered: updated,
    total: sorted.length,
    message: `${updated} partidas reordered in logical construction sequence`,
    chapters: summary,
  }
}

// ============================================================
// BIM Formula Evaluator
// ============================================================

function evaluateFormula(formula: string, parametros: Record<string, number>): number | null {
  try {
    let expression = formula
    // Replace variable names with values (longest names first to avoid partial matches)
    const keys = Object.keys(parametros).sort((a, b) => b.length - a.length)
    for (const key of keys) {
      expression = expression.replace(new RegExp(`\\b${key}\\b`, 'g'), String(parametros[key]))
    }

    // If unreplaced variables remain, return null
    if (/[a-zA-Z_]/.test(expression)) return null

    // Only allow numbers, operators, parentheses, spaces, dots
    if (!/^[\d\s.+\-*/()]+$/.test(expression)) return null

    const result = Function(`"use strict"; return (${expression})`)()
    return typeof result === 'number' && isFinite(result) && result >= 0
      ? Math.round(result * 10000) / 10000
      : null
  } catch {
    return null
  }
}

// ============================================================
// BIM Handlers
// ============================================================

async function handleGetBimImports(params: Record<string, unknown>) {
  const admin = getAdmin()
  const proyecto_id = params.proyecto_id as string
  if (!proyecto_id) throw new Error('proyecto_id is required')

  const { data, error } = await admin
    .from('bim_importaciones')
    .select('id, proyecto_id, archivo_nombre, total_elementos, elementos_mapeados, estado, metadata, created_at')
    .eq('proyecto_id', proyecto_id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return { imports: data || [], count: data?.length || 0 }
}

async function handleGetBimElements(params: Record<string, unknown>) {
  const admin = getAdmin()
  const importacion_id = params.importacion_id as string
  if (!importacion_id) throw new Error('importacion_id is required')

  const estado = params.estado as string | undefined
  const limit = Math.min((params.limit as number) || 100, 500)
  const offset = (params.offset as number) || 0

  let query = admin
    .from('bim_elementos')
    .select(`
      id, revit_id, familia, tipo, parametros, metrado_calculado, estado,
      revit_categorias(id, nombre, nombre_es),
      partidas(id, nombre, unidad, capitulo)
    `)
    .eq('importacion_id', importacion_id)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: true })

  if (estado) query = query.eq('estado', estado)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const { count: total } = await admin
    .from('bim_elementos')
    .select('id', { count: 'exact', head: true })
    .eq('importacion_id', importacion_id)

  return { elements: data || [], count: data?.length || 0, total: total || 0, offset, limit }
}

async function handleGetRevitMapeos(params: Record<string, unknown>) {
  const admin = getAdmin()
  const revit_categoria_id = params.revit_categoria_id as string | undefined

  let query = admin
    .from('revit_mapeos')
    .select(`
      id, formula, parametro_principal, descripcion, prioridad,
      revit_categorias(id, nombre, nombre_es),
      partidas(id, nombre, unidad, capitulo)
    `)
    .order('revit_categoria_id')
    .order('prioridad', { ascending: true })

  if (revit_categoria_id) query = query.eq('revit_categoria_id', revit_categoria_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return { mapeos: data || [], count: data?.length || 0 }
}

async function handleImportBimElements(params: Record<string, unknown>) {
  const admin = getAdmin()
  const proyecto_id = params.proyecto_id as string
  const archivo_nombre = (params.archivo_nombre as string) || 'Revit Export'
  const elementos = params.elementos as Array<{
    revit_id: string
    unique_id?: string
    categoria: string
    familia: string
    tipo: string
    parametros: Record<string, number>
    metadata?: Record<string, string>
  }>

  if (!proyecto_id) throw new Error('proyecto_id is required')
  if (!elementos?.length) throw new Error('elementos array is required')

  // Load all revit categories for name→id resolution (try nombre and nombre_es)
  const { data: categorias } = await admin
    .from('revit_categorias')
    .select('id, nombre, nombre_es')

  const catMap = new Map<string, string>()
  for (const c of categorias || []) {
    catMap.set(c.nombre, c.id)               // English: "Walls"
    if (c.nombre_es) catMap.set(c.nombre_es, c.id) // Spanish: "Muros"
  }

  // Aliases: Add-in C# uses different Spanish names than BD nombre_es
  // Map common aliases to their English category names, then resolve
  const aliases: Record<string, string> = {
    'Pisos': 'Floors', 'Losas': 'Floors', 'Pisos/Losas': 'Floors',
    'Cielorrasos': 'Ceilings', 'Cielos Rasos': 'Ceilings', 'Cielo Raso': 'Ceilings',
    'Pilares Est.': 'Structural Columns', 'Pilares Estructurales': 'Structural Columns',
    'Columnas': 'Structural Columns', 'Columnas Estructurales': 'Structural Columns',
    'Vigas/Cerchas': 'Structural Framing', 'Vigas': 'Structural Framing',
    'Vigas Estructurales': 'Structural Framing',
    'Sanitarios': 'Plumbing Fixtures', 'Aparatos Sanitarios': 'Plumbing Fixtures',
    'Artefactos Eléc.': 'Electrical Fixtures', 'Aparatos Eléctricos': 'Electrical Fixtures',
    'Luminarias': 'Electrical Fixtures', 'Eq. Eléctrico': 'Electrical Fixtures',
    'Fundaciones': 'Structural Columns', // closest match
    'Cubiertas': 'Roofs', 'Escaleras': 'Stairs', 'Barandas': 'Railings',
    'Muros': 'Walls', 'Puertas': 'Doors', 'Ventanas': 'Windows',
    'Paneles Muro Cortina': 'Walls', 'Montantes Muro Cortina': 'Railings',
    'Curtain Wall': 'Walls', 'Basic Wall': 'Walls',
  }
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (!catMap.has(alias) && catMap.has(canonical)) {
      catMap.set(alias, catMap.get(canonical)!)
    }
  }

  // Create importacion
  const { data: importacion, error: impErr } = await admin
    .from('bim_importaciones')
    .insert({
      proyecto_id,
      archivo_nombre,
      total_elementos: elementos.length,
      elementos_mapeados: 0,
      estado: 'pendiente',
      metadata: { source: 'mcp_webhook' },
    })
    .select()
    .single()

  if (impErr) throw new Error(impErr.message)

  // Insert elements in batches of 50
  // Store numeric params + text metadata together in JSONB parametros
  const rows = elementos.map(e => {
    const allParams: Record<string, unknown> = { ...(e.parametros || {}) }
    if (e.metadata && Object.keys(e.metadata).length > 0) {
      allParams._metadata = e.metadata
    }
    if (e.unique_id) {
      allParams._unique_id = e.unique_id
    }
    return {
      importacion_id: importacion.id,
      revit_id: e.revit_id || null,
      revit_categoria_id: catMap.get(e.categoria) || null,
      familia: e.familia || null,
      tipo: e.tipo || null,
      parametros: allParams,
      estado: 'pendiente' as const,
    }
  })

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50)
    const { error: elemErr } = await admin.from('bim_elementos').insert(batch)
    if (elemErr) throw new Error(elemErr.message)
  }

  const withCategory = rows.filter(r => r.revit_categoria_id !== null).length
  const unknownCategories = [...new Set(
    elementos.filter(e => !catMap.has(e.categoria)).map(e => e.categoria)
  )]

  return {
    importacion_id: importacion.id,
    total_elementos: elementos.length,
    con_categoria: withCategory,
    sin_categoria: elementos.length - withCategory,
    categorias_desconocidas: unknownCategories,
    message: `Import created: ${elementos.length} elements (${withCategory} with valid category)`,
  }
}

async function handleMatchBimElements(params: Record<string, unknown>) {
  const admin = getAdmin()
  const importacion_id = params.importacion_id as string
  if (!importacion_id) throw new Error('importacion_id is required')

  // Update import status
  await admin.from('bim_importaciones').update({ estado: 'procesando' }).eq('id', importacion_id)

  // Load all pending elements
  const { data: elementos, error } = await admin
    .from('bim_elementos')
    .select('id, revit_id, revit_categoria_id, familia, tipo, parametros')
    .eq('importacion_id', importacion_id)
    .eq('estado', 'pendiente')

  if (error) throw new Error(error.message)
  if (!elementos?.length) {
    await admin.from('bim_importaciones').update({ estado: 'completado' }).eq('id', importacion_id)
    return { original_elements: 0, matched: 0, derived_created: 0, no_match: 0, message: 'No pending elements found' }
  }

  // Load all mapeos grouped by category (include partida info + instrucciones for write-back)
  const { data: mapeos } = await admin
    .from('revit_mapeos')
    .select('id, revit_categoria_id, partida_id, formula, parametro_principal, prioridad, instrucciones_computo, descripcion, condicion_filtro, partidas(nombre, unidad, partida_localizaciones(codigo_local, estandares(codigo)))')
    .order('prioridad', { ascending: true })

  if (!mapeos?.length) {
    await admin.from('bim_importaciones').update({ estado: 'error' }).eq('id', importacion_id)
    throw new Error('No mapeos configured in the system')
  }

  const mapeosByCat = new Map<string, typeof mapeos>()
  for (const m of mapeos) {
    const cid = m.revit_categoria_id as string
    if (!mapeosByCat.has(cid)) mapeosByCat.set(cid, [])
    mapeosByCat.get(cid)!.push(m)
  }

  let matched = 0
  let derivedCreated = 0
  let noMatch = 0

  for (const elem of elementos) {
    const catId = elem.revit_categoria_id as string
    if (!catId) {
      await admin.from('bim_elementos').update({ estado: 'error' }).eq('id', elem.id)
      noMatch++
      continue
    }

    const catMapeos = mapeosByCat.get(catId)
    if (!catMapeos?.length) {
      await admin.from('bim_elementos').update({ estado: 'error' }).eq('id', elem.id)
      noMatch++
      continue
    }

    // Extract only numeric params (skip _metadata, _unique_id)
    const rawParams = (elem.parametros || {}) as Record<string, unknown>
    const paramData: Record<string, number> = {}
    for (const [k, v] of Object.entries(rawParams)) {
      if (!k.startsWith('_') && typeof v === 'number') paramData[k] = v
    }
    let firstDone = false

    for (const mapeo of catMapeos) {
      // Evaluate condicion_filtro: if present and <= 0, skip this mapeo
      if (mapeo.condicion_filtro) {
        const condResult = evaluateFormula(mapeo.condicion_filtro as string, paramData)
        if (condResult === null || condResult <= 0) continue
      }

      const result = evaluateFormula(mapeo.formula, paramData)
      if (result === null || result <= 0) continue

      // Extract partida info for write-back
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const partidaData = mapeo.partidas as any
      const partidaNombre = partidaData?.nombre || null
      const locs = Array.isArray(partidaData?.partida_localizaciones) ? partidaData.partida_localizaciones : []
      const codigoLocal = locs[0]?.codigo_local || null
      const notasMapeo = mapeo.instrucciones_computo || mapeo.descripcion || null

      if (!firstDone) {
        // Update original element with first matching mapeo
        await admin.from('bim_elementos').update({
          partida_id: mapeo.partida_id,
          metrado_calculado: result,
          formula_usada: mapeo.formula,
          partida_codigo: codigoLocal,
          partida_nombre: partidaNombre,
          notas_mapeo: notasMapeo,
          estado: 'mapeado',
        }).eq('id', elem.id)
        firstDone = true
        matched++
      } else {
        // Create derived element for additional mapeos
        await admin.from('bim_elementos').insert({
          importacion_id,
          revit_id: elem.revit_id,
          revit_categoria_id: catId,
          familia: elem.familia,
          tipo: elem.tipo,
          parametros: elem.parametros,
          partida_id: mapeo.partida_id,
          metrado_calculado: result,
          formula_usada: mapeo.formula,
          partida_codigo: codigoLocal,
          partida_nombre: partidaNombre,
          notas_mapeo: notasMapeo,
          estado: 'mapeado',
        })
        derivedCreated++
        matched++
      }
    }

    if (!firstDone) {
      await admin.from('bim_elementos').update({ estado: 'error' }).eq('id', elem.id)
      noMatch++
    }
  }

  // Update importacion stats
  await admin.from('bim_importaciones').update({
    elementos_mapeados: matched,
    estado: 'completado',
  }).eq('id', importacion_id)

  return {
    original_elements: elementos.length,
    matched,
    derived_created: derivedCreated,
    no_match: noMatch,
    message: `Match complete: ${matched} mappings from ${elementos.length} elements (${derivedCreated} derived)`,
  }
}

async function handleConfirmBimMatch(params: Record<string, unknown>) {
  const admin = getAdmin()
  const importacion_id = params.importacion_id as string
  const elemento_ids = params.elemento_ids as string[] | undefined

  if (!importacion_id) throw new Error('importacion_id is required')

  // Get the import to find proyecto_id
  const { data: importacion } = await admin
    .from('bim_importaciones')
    .select('proyecto_id')
    .eq('id', importacion_id)
    .single()

  if (!importacion) throw new Error('Import not found')
  const proyecto_id = importacion.proyecto_id as string

  // Load matched elements
  let query = admin
    .from('bim_elementos')
    .select('partida_id, metrado_calculado')
    .eq('importacion_id', importacion_id)
    .eq('estado', 'mapeado')

  if (elemento_ids?.length) query = query.in('id', elemento_ids)

  const { data: elementos, error } = await query
  if (error) throw new Error(error.message)
  if (!elementos?.length) throw new Error('No matched elements to confirm')

  // Aggregate metrados by partida
  const partidaMetrados = new Map<string, number>()
  for (const elem of elementos) {
    const pid = elem.partida_id as string
    if (!pid) continue
    const met = (elem.metrado_calculado as number) || 0
    partidaMetrados.set(pid, (partidaMetrados.get(pid) || 0) + met)
  }

  // Get current max orden for new partidas
  const { data: maxRow } = await admin
    .from('proyecto_partidas')
    .select('orden')
    .eq('proyecto_id', proyecto_id)
    .order('orden', { ascending: false })
    .limit(1)
    .single()

  let nextOrden = ((maxRow?.orden as number) ?? 0) + 1
  let created = 0
  let updated = 0

  for (const [partida_id, metrado_bim] of partidaMetrados) {
    const rounded = Math.round(metrado_bim * 10000) / 10000

    // Check if partida already in project
    const { data: existing } = await admin
      .from('proyecto_partidas')
      .select('id, metrado_bim')
      .eq('proyecto_id', proyecto_id)
      .eq('partida_id', partida_id)
      .maybeSingle()

    if (existing) {
      const newBim = ((existing.metrado_bim as number) || 0) + rounded
      await admin
        .from('proyecto_partidas')
        .update({ metrado_bim: Math.round(newBim * 10000) / 10000 })
        .eq('id', existing.id)
      updated++
    } else {
      await admin
        .from('proyecto_partidas')
        .insert({
          proyecto_id,
          partida_id,
          cantidad: 1,
          metrado_bim: rounded,
          metrado_final: rounded,
          orden: nextOrden++,
        })
      created++
    }
  }

  // Mark confirmed elements as revisado
  let confirmQ = admin
    .from('bim_elementos')
    .update({ estado: 'revisado' })
    .eq('importacion_id', importacion_id)
    .eq('estado', 'mapeado')

  if (elemento_ids?.length) confirmQ = confirmQ.in('id', elemento_ids)
  await confirmQ

  // Reorder project partidas by chapter
  await handleReorderProjectPartidas({ proyecto_id })

  return {
    created,
    updated,
    total_partidas: partidaMetrados.size,
    message: `${created} partidas created, ${updated} updated with BIM metrados`,
  }
}

// ============================================================
// BIM Mapping Management — CRUD for revit_mapeos + AI helpers
// ============================================================

async function handleGetBimElementDetail(params: Record<string, unknown>) {
  const admin = getAdmin()
  const elemento_id = params.elemento_id as string
  if (!elemento_id) throw new Error('elemento_id is required')

  const { data, error } = await admin
    .from('bim_elementos')
    .select(`
      id, revit_id, familia, tipo, parametros, metrado_calculado, estado,
      revit_categorias(id, nombre, nombre_es, parametros_clave),
      partidas(id, nombre, unidad, capitulo, descripcion),
      bim_importaciones(id, proyecto_id, archivo_nombre)
    `)
    .eq('id', elemento_id)
    .single()

  if (error) throw new Error(error.message)

  // Extract metadata and numeric params separately for readability
  const rawParams = (data.parametros || {}) as Record<string, unknown>
  const numericParams: Record<string, number> = {}
  const metadata: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawParams)) {
    if (k === '_metadata' && typeof v === 'object' && v !== null) {
      Object.assign(metadata, v)
    } else if (k === '_unique_id') {
      metadata.unique_id = v as string
    } else if (typeof v === 'number') {
      numericParams[k] = v
    }
  }

  // Get available mapeos for this element's category
  const catData = data.revit_categorias as unknown as { id: string } | null
  const catId = catData?.id
  let availableMapeos: unknown[] = []
  if (catId) {
    const { data: mapeos } = await admin
      .from('revit_mapeos')
      .select('id, formula, parametro_principal, descripcion, prioridad, partidas(id, nombre, unidad, capitulo)')
      .eq('revit_categoria_id', catId)
      .order('prioridad', { ascending: true })
    availableMapeos = mapeos || []
  }

  return {
    element: {
      ...data,
      numeric_params: numericParams,
      metadata,
    },
    available_mapeos: availableMapeos,
  }
}

async function handleCreateRevitMapeo(params: Record<string, unknown>) {
  const admin = getAdmin()
  const revit_categoria_id = params.revit_categoria_id as string
  const partida_id = params.partida_id as string
  const formula = params.formula as string
  const parametro_principal = (params.parametro_principal as string) || null
  const descripcion = (params.descripcion as string) || null
  const instrucciones_computo = (params.instrucciones_computo as string) || null
  const prioridad = (params.prioridad as number) || 0

  if (!revit_categoria_id) throw new Error('revit_categoria_id is required')
  if (!partida_id) throw new Error('partida_id is required')
  if (!formula) throw new Error('formula is required (e.g. "Area * 1.05", "Volume", "Count")')

  // Validate formula syntax by testing with dummy values
  const testParams: Record<string, number> = {
    Area: 100, AreaBruta: 110, AreaExt: 100, OpeningsArea: 10,
    Volume: 10, Length: 5, Height: 3, Width: 0.2, Count: 1,
  }
  const testResult = evaluateFormula(formula, testParams)
  if (testResult === null) {
    throw new Error(`Invalid formula: "${formula}" — must be arithmetic using param names`)
  }

  const { data, error } = await admin
    .from('revit_mapeos')
    .insert({
      revit_categoria_id,
      partida_id,
      formula,
      parametro_principal,
      descripcion,
      instrucciones_computo,
      prioridad,
    })
    .select('id, formula, parametro_principal, descripcion, instrucciones_computo, prioridad')
    .single()

  if (error) throw new Error(error.message)
  return { mapeo: data, test_result: testResult }
}

async function handleUpdateRevitMapeo(params: Record<string, unknown>) {
  const admin = getAdmin()
  const mapeo_id = params.mapeo_id as string
  if (!mapeo_id) throw new Error('mapeo_id is required')

  const updates: Record<string, unknown> = {}
  if (params.formula !== undefined) {
    const formula = params.formula as string
    const testParams: Record<string, number> = {
      Area: 100, AreaBruta: 110, AreaExt: 100, OpeningsArea: 10,
      Volume: 10, Length: 5, Height: 3, Width: 0.2, Count: 1,
    }
    if (evaluateFormula(formula, testParams) === null) {
      throw new Error(`Invalid formula: "${formula}"`)
    }
    updates.formula = formula
  }
  if (params.partida_id !== undefined) updates.partida_id = params.partida_id
  if (params.parametro_principal !== undefined) updates.parametro_principal = params.parametro_principal
  if (params.descripcion !== undefined) updates.descripcion = params.descripcion
  if (params.instrucciones_computo !== undefined) updates.instrucciones_computo = params.instrucciones_computo
  if (params.prioridad !== undefined) updates.prioridad = params.prioridad

  if (Object.keys(updates).length === 0) throw new Error('No fields to update')

  const { data, error } = await admin
    .from('revit_mapeos')
    .update(updates)
    .eq('id', mapeo_id)
    .select('id, formula, parametro_principal, descripcion, instrucciones_computo, prioridad')
    .single()

  if (error) throw new Error(error.message)
  return { mapeo: data }
}

async function handleDeleteRevitMapeo(params: Record<string, unknown>) {
  const admin = getAdmin()
  const mapeo_id = params.mapeo_id as string
  if (!mapeo_id) throw new Error('mapeo_id is required')

  const { error } = await admin
    .from('revit_mapeos')
    .delete()
    .eq('id', mapeo_id)

  if (error) throw new Error(error.message)
  return { deleted: true }
}

async function handleApplyMappingToElement(params: Record<string, unknown>) {
  const admin = getAdmin()
  const elemento_id = params.elemento_id as string
  const partida_id = params.partida_id as string
  const formula = params.formula as string | undefined
  const metrado = params.metrado as number | undefined
  const notas_mapeo = params.notas_mapeo as string | undefined

  if (!elemento_id) throw new Error('elemento_id is required')
  if (!partida_id) throw new Error('partida_id is required')

  // Get element to evaluate formula against its params
  const { data: elem, error: fetchErr } = await admin
    .from('bim_elementos')
    .select('parametros')
    .eq('id', elemento_id)
    .single()

  if (fetchErr) throw new Error(fetchErr.message)

  let calculatedMetrado = metrado
  if (!calculatedMetrado && formula) {
    const rawParams = (elem.parametros || {}) as Record<string, unknown>
    const numParams: Record<string, number> = {}
    for (const [k, v] of Object.entries(rawParams)) {
      if (!k.startsWith('_') && typeof v === 'number') numParams[k] = v
    }
    const result = evaluateFormula(formula, numParams)
    if (result === null) throw new Error(`Formula "${formula}" failed to evaluate`)
    calculatedMetrado = result
  }

  if (!calculatedMetrado) throw new Error('Either formula or metrado is required')

  // Get partida info for write-back fields
  const { data: partida } = await admin
    .from('partidas')
    .select('nombre, partida_localizaciones(codigo_local)')
    .eq('id', partida_id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partidaInfo = partida as any
  const locs = Array.isArray(partidaInfo?.partida_localizaciones) ? partidaInfo.partida_localizaciones : []

  const { data, error } = await admin
    .from('bim_elementos')
    .update({
      partida_id,
      metrado_calculado: Math.round(calculatedMetrado * 10000) / 10000,
      formula_usada: formula || null,
      partida_codigo: locs[0]?.codigo_local || null,
      partida_nombre: partidaInfo?.nombre || null,
      notas_mapeo: notas_mapeo || null,
      estado: 'mapeado',
    })
    .eq('id', elemento_id)
    .select('id, partida_id, metrado_calculado, formula_usada, partida_nombre, notas_mapeo, estado')
    .single()

  if (error) throw new Error(error.message)
  return { element: data, formula_used: formula || null }
}

async function handleGetElementMappings(params: Record<string, unknown>) {
  const admin = getAdmin()
  const importacion_id = params.importacion_id as string
  const proyecto_id = params.proyecto_id as string

  if (!importacion_id && !proyecto_id) {
    throw new Error('importacion_id or proyecto_id is required')
  }

  let query = admin
    .from('bim_elementos')
    .select(`
      id, revit_id, familia, tipo, metrado_calculado, estado,
      formula_usada, partida_codigo, partida_nombre, notas_mapeo,
      parametros,
      revit_categorias(nombre, nombre_es),
      partidas(id, nombre, unidad, capitulo,
        partida_localizaciones(codigo_local, referencia_norma, estandares(codigo))
      )
    `)
    .in('estado', ['mapeado', 'revisado', 'confirmado'])
    .not('partida_id', 'is', null)

  if (importacion_id) {
    query = query.eq('importacion_id', importacion_id)
  } else {
    // Get latest import for project
    const { data: imp } = await admin
      .from('bim_importaciones')
      .select('id')
      .eq('proyecto_id', proyecto_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (!imp) return { mappings: [], count: 0 }
    query = query.eq('importacion_id', imp.id)
  }

  const { data, error } = await query.order('revit_id')
  if (error) throw new Error(error.message)

  // Format for Revit write-back: revit_id → partida code + metrado
  const mappings = (data || []).map(el => {
    const rawParams = (el.parametros || {}) as Record<string, unknown>
    const uniqueId = rawParams._unique_id as string || null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partida = el.partidas as any
    const cat = el.revit_categorias as any
    const loc = partida?.partida_localizaciones?.[0]
    return {
      revit_id: el.revit_id,
      unique_id: uniqueId,
      categoria: cat?.nombre || null,
      familia: el.familia,
      tipo: el.tipo,
      // Write-back fields for Revit COS_* shared parameters
      partida_nombre: el.partida_nombre || partida?.nombre || null,
      partida_codigo: el.partida_codigo || loc?.codigo_local || null,
      partida_unidad: partida?.unidad || null,
      formula: el.formula_usada || null,
      metrado: el.metrado_calculado,
      notas_mapeo: el.notas_mapeo || null,
      estado: el.estado,
    }
  })

  return { mappings, count: mappings.length }
}

// ============================================================
// BIM Skills — Intelligent mapping analysis per country/norm
// ============================================================

async function handleAnalyzeBimImport(params: Record<string, unknown>) {
  const admin = getAdmin()
  const importacion_id = params.importacion_id as string
  if (!importacion_id) throw new Error('importacion_id is required')
  const pais_codigo = (params.pais_codigo as string) || null

  // Get import + project info
  const { data: imp } = await admin
    .from('bim_importaciones')
    .select('id, proyecto_id, archivo_nombre, total_elementos, estado, proyectos(nombre, pais_id, tipologia, paises(codigo, nombre))')
    .eq('id', importacion_id)
    .single()

  if (!imp) throw new Error('Import not found')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proyecto = imp.proyectos as any
  const paisCodigo = pais_codigo || proyecto?.paises?.codigo || 'BO'

  // Get all elements grouped by category
  const { data: elements } = await admin
    .from('bim_elementos')
    .select('id, revit_id, familia, tipo, parametros, estado, metrado_calculado, revit_categorias(id, nombre, nombre_es), partidas(id, nombre, unidad)')
    .eq('importacion_id', importacion_id)

  // Get existing mapeos
  const { data: mapeos } = await admin
    .from('revit_mapeos')
    .select('id, revit_categoria_id, formula, partidas(nombre, unidad)')
    .order('prioridad')

  // Get country standard
  const { data: estandar } = await admin
    .from('estandares')
    .select('id, codigo, nombre')
    .eq('codigo', paisCodigo === 'BO' ? 'NB' : paisCodigo === 'PE' ? 'RNE' : 'NB')
    .limit(1)
    .maybeSingle()

  // Build category summary
  const catSummary: Record<string, {
    nombre_es: string, total: number, mapeados: number, pendientes: number,
    sin_match: number, confirmados: number, reglas_existentes: number,
    tipos_unicos: string[], ejemplo_params: string[]
  }> = {}

  const mapeoCountByCat = new Map<string, number>()
  for (const m of mapeos || []) {
    const cid = m.revit_categoria_id as string
    mapeoCountByCat.set(cid, (mapeoCountByCat.get(cid) || 0) + 1)
  }

  for (const el of elements || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cat = el.revit_categorias as any
    const catName = cat?.nombre || 'Sin categoría'
    const catEs = cat?.nombre_es || catName
    const catId = cat?.id || 'none'

    if (!catSummary[catName]) {
      catSummary[catName] = {
        nombre_es: catEs, total: 0, mapeados: 0, pendientes: 0,
        sin_match: 0, confirmados: 0,
        reglas_existentes: mapeoCountByCat.get(catId) || 0,
        tipos_unicos: [], ejemplo_params: [],
      }
    }

    const s = catSummary[catName]
    s.total++
    if (el.estado === 'mapeado') s.mapeados++
    else if (el.estado === 'pendiente') s.pendientes++
    else if (el.estado === 'error' || el.estado === 'sin_match') s.sin_match++
    else if (el.estado === 'confirmado' || el.estado === 'revisado') s.confirmados++

    const tipoKey = `${el.familia} / ${el.tipo}`
    if (!s.tipos_unicos.includes(tipoKey)) s.tipos_unicos.push(tipoKey)

    // Show sample params for first element of each category
    if (s.ejemplo_params.length === 0) {
      const raw = (el.parametros || {}) as Record<string, unknown>
      const numParams = Object.entries(raw)
        .filter(([k, v]) => !k.startsWith('_') && typeof v === 'number' && (v as number) > 0)
        .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
      s.ejemplo_params = numParams.slice(0, 8)
    }
  }

  // Categories missing rules
  const catsMissingRules = Object.entries(catSummary)
    .filter(([, s]) => s.reglas_existentes === 0 && s.total > 0)
    .map(([name, s]) => ({ categoria: name, nombre_es: s.nombre_es, elementos: s.total }))

  return {
    proyecto: {
      nombre: proyecto?.nombre,
      pais: proyecto?.paises?.nombre,
      pais_codigo: paisCodigo,
      tipologia: proyecto?.tipologia,
      estandar: estandar?.nombre || null,
    },
    archivo: imp.archivo_nombre,
    estado_import: imp.estado,
    resumen: {
      total_elementos: (elements || []).length,
      categorias: Object.keys(catSummary).length,
      mapeados: (elements || []).filter(e => e.estado === 'mapeado').length,
      confirmados: (elements || []).filter(e => e.estado === 'confirmado' || e.estado === 'revisado').length,
      pendientes: (elements || []).filter(e => e.estado === 'pendiente').length,
      sin_match: (elements || []).filter(e => e.estado === 'error' || e.estado === 'sin_match').length,
    },
    por_categoria: catSummary,
    categorias_sin_reglas: catsMissingRules,
    total_reglas_mapeo: (mapeos || []).length,
    instruccion: `Analiza este import y sugiere acciones. Para categorias sin reglas, usa suggest_element_mapping con un elemento de ejemplo. Para crear reglas nuevas, usa create_revit_mapeo. Para aplicar mapeos existentes, usa match_bim_elements.`,
  }
}

async function handleSuggestElementMapping(params: Record<string, unknown>) {
  const admin = getAdmin()
  const elemento_id = params.elemento_id as string
  if (!elemento_id) throw new Error('elemento_id is required')
  const pais_codigo = (params.pais_codigo as string) || 'BO'

  // Get element detail
  const { data: elem, error } = await admin
    .from('bim_elementos')
    .select(`
      id, revit_id, familia, tipo, parametros, estado, metrado_calculado,
      revit_categorias(id, nombre, nombre_es, parametros_clave),
      partidas(id, nombre, unidad),
      bim_importaciones(proyecto_id, proyectos(pais_id, paises(codigo)))
    `)
    .eq('id', elemento_id)
    .single()

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cat = elem.revit_categorias as any
  const catId = cat?.id
  const catNombre = cat?.nombre_es || cat?.nombre || 'Desconocida'

  // Extract numeric params and metadata
  const rawParams = (elem.parametros || {}) as Record<string, unknown>
  const numericParams: Record<string, number> = {}
  const metadata: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawParams)) {
    if (k === '_metadata' && typeof v === 'object' && v !== null) {
      Object.assign(metadata, v)
    } else if (k === '_unique_id') {
      // skip
    } else if (typeof v === 'number' && v > 0) {
      numericParams[k] = Math.round(v * 10000) / 10000
    }
  }

  // Get existing mapeos for this category
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existingMapeos: any[] = []
  if (catId) {
    const { data: mapeos } = await admin
      .from('revit_mapeos')
      .select('id, formula, prioridad, descripcion, partidas(nombre, unidad)')
      .eq('revit_categoria_id', catId)
      .order('prioridad')
    existingMapeos = mapeos || []
  }

  // Evaluate existing formulas against this element's params
  const evaluatedMapeos = existingMapeos.map(m => {
    const result = evaluateFormula(m.formula, numericParams)
    return {
      mapeo_id: m.id,
      formula: m.formula,
      prioridad: m.prioridad,
      descripcion: m.descripcion,
      partida: m.partidas,
      resultado: result,
      aplica: result !== null && result > 0,
    }
  })

  // Resolve estandar for this country
  const estandarMap: Record<string, string> = { BO: 'NB', PE: 'RNE', BR: 'ABNT', US: 'CSI', AR: 'CIRSOC', CL: 'NCh' }
  const estandarCode = estandarMap[pais_codigo] || 'NB'

  // Search catalog for partidas that could match this category
  // Use tags to find relevant partidas
  const { data: candidatePartidas } = await admin
    .from('partidas')
    .select(`
      id, nombre, unidad, capitulo, descripcion,
      partida_localizaciones!inner(codigo_local, referencia_norma, estandares!inner(codigo))
    `)
    .eq('partida_localizaciones.estandares.codigo', estandarCode)
    .order('capitulo')
    .limit(30)

  // Filter candidates by category relevance (heuristic: match chapter keywords)
  const catKeywords: Record<string, string[]> = {
    Walls: ['muro', 'ladrillo', 'revoque', 'enlucido', 'pintura', 'tabique', 'tarrajeo'],
    'Structural Columns': ['columna', 'hormigón', 'encofrado', 'acero', 'refuerzo'],
    'Structural Framing': ['viga', 'hormigón', 'encofrado', 'acero', 'cercha'],
    Floors: ['losa', 'piso', 'contrapiso', 'cerámico', 'impermeabilización', 'alivianada'],
    Ceilings: ['cielo', 'enlucido', 'yeso', 'pintura'],
    Roofs: ['cubierta', 'impermeabilización', 'calamina', 'teja'],
    Doors: ['puerta', 'marco', 'madera', 'metálica'],
    Windows: ['ventana', 'vidrio', 'aluminio', 'cristal'],
    Stairs: ['escalera', 'pasamano', 'hormigón'],
    Railings: ['baranda', 'pasamano', 'metálica'],
    'Plumbing Fixtures': ['inodoro', 'lavamano', 'ducha', 'sanitario', 'grifo'],
    'Electrical Fixtures': ['iluminación', 'tomacorriente', 'tablero', 'eléctric'],
  }
  const keywords = catKeywords[cat?.nombre || ''] || []
  const relevantPartidas = (candidatePartidas || []).filter(p => {
    const text = `${p.nombre} ${p.capitulo || ''} ${p.descripcion || ''}`.toLowerCase()
    return keywords.some(kw => text.includes(kw))
  }).slice(0, 15)

  // Suggest formulas based on element params and metadata
  const suggestedFormulas: string[] = []
  if (numericParams.Area > 0 && numericParams.OpeningsArea >= 0) {
    suggestedFormulas.push('Area - OpeningsArea')
    suggestedFormulas.push('(Area - OpeningsArea) * 1.05')
  }
  if (numericParams.Area > 0) suggestedFormulas.push('Area')
  if (numericParams.Volume > 0) {
    suggestedFormulas.push('Volume')
    suggestedFormulas.push('Volume * 78.5')
  }
  if (numericParams.Length > 0) suggestedFormulas.push('Length')
  if (numericParams.Count > 0) suggestedFormulas.push('Count')
  if (numericParams.Width > 0 && numericParams.Height > 0 && numericParams.Length > 0) {
    suggestedFormulas.push('(Width + Height * 2) * Length')
  }

  return {
    elemento: {
      id: elem.id,
      revit_id: elem.revit_id,
      familia: elem.familia,
      tipo: elem.tipo,
      categoria: catNombre,
      categoria_revit: cat?.nombre,
      revit_categoria_id: catId,
      estado: elem.estado,
    },
    parametros_numericos: numericParams,
    metadata,
    mapeos_existentes: evaluatedMapeos,
    partidas_candidatas: relevantPartidas.map(p => ({
      id: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      capitulo: p.capitulo,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      codigo_local: (p.partida_localizaciones as any)?.[0]?.codigo_local,
    })),
    formulas_sugeridas: suggestedFormulas,
    pais_codigo: pais_codigo,
    estandar: estandarCode,
    instruccion: `Analiza los parametros del elemento y los mapeos existentes. Si faltan mapeos, usa create_revit_mapeo con la formula apropiada y la partida candidata. Si el mapeo existe pero no aplica, revisa la formula. Para aplicar directamente, usa apply_mapping_to_element.`,
  }
}

async function handleGetMappingCoverage(params: Record<string, unknown>) {
  const admin = getAdmin()
  const pais_codigo = (params.pais_codigo as string) || null

  // Get all categories
  const { data: categorias } = await admin
    .from('revit_categorias')
    .select('id, nombre, nombre_es')

  // Get all mapeos with partida info
  const { data: mapeos } = await admin
    .from('revit_mapeos')
    .select('id, revit_categoria_id, formula, parametro_principal, prioridad, descripcion, partidas(id, nombre, unidad, capitulo)')
    .order('revit_categoria_id')
    .order('prioridad')

  // Get country-specific localization count
  let locCount = 0
  if (pais_codigo) {
    const estandarMap: Record<string, string> = { BO: 'NB', PE: 'RNE', BR: 'ABNT', US: 'CSI' }
    const estCode = estandarMap[pais_codigo]
    if (estCode) {
      const { count } = await admin
        .from('partida_localizaciones')
        .select('id', { count: 'exact', head: true })
        .eq('estandares.codigo', estCode)
      locCount = count || 0
    }
  }

  // Build coverage per category
  const coverage = (categorias || []).map(cat => {
    const catMapeos = (mapeos || []).filter(m => m.revit_categoria_id === cat.id)
    return {
      categoria: cat.nombre,
      nombre_es: cat.nombre_es,
      reglas: catMapeos.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      partidas: catMapeos.map(m => ({
        formula: m.formula,
        prioridad: m.prioridad,
        descripcion: m.descripcion,
        partida: (m.partidas as any)?.nombre,
        unidad: (m.partidas as any)?.unidad,
      })),
      tiene_cobertura: catMapeos.length > 0,
    }
  })

  const conCobertura = coverage.filter(c => c.tiene_cobertura).length
  const sinCobertura = coverage.filter(c => !c.tiene_cobertura)

  // Get total catalog partidas
  const { count: totalPartidas } = await admin
    .from('partidas')
    .select('id', { count: 'exact', head: true })

  return {
    resumen: {
      categorias_total: (categorias || []).length,
      categorias_con_reglas: conCobertura,
      categorias_sin_reglas: sinCobertura.length,
      total_reglas: (mapeos || []).length,
      total_partidas_catalogo: totalPartidas || 0,
      localizaciones_pais: locCount,
    },
    cobertura_por_categoria: coverage,
    categorias_sin_cobertura: sinCobertura.map(c => ({
      categoria: c.categoria,
      nombre_es: c.nombre_es,
    })),
    pais_codigo: pais_codigo,
    instruccion: `Usa esta información para identificar gaps en el estándar de mapeo. Para categorías sin cobertura, analiza elementos de ejemplo con suggest_element_mapping y crea reglas con create_revit_mapeo.`,
  }
}

async function handleResolveBimCategories(params: Record<string, unknown>) {
  const admin = getAdmin()
  const importacion_id = params.importacion_id as string
  if (!importacion_id) throw new Error('importacion_id is required')

  // Load categories
  const { data: categorias } = await admin
    .from('revit_categorias')
    .select('id, nombre, nombre_es')

  const catNameToId = new Map<string, string>()
  for (const c of categorias || []) {
    catNameToId.set(c.nombre.toLowerCase(), c.id)
    if (c.nombre_es) catNameToId.set(c.nombre_es.toLowerCase(), c.id)
  }

  // Familia → category mapping (Revit family names → English category)
  const familiaMap: Record<string, string> = {
    // Walls
    'basic wall': 'walls', 'curtain wall': 'walls', 'stacked wall': 'walls',
    // Floors
    'floor': 'floors',
    // Ceilings
    'compound ceiling': 'ceilings', 'basic ceiling': 'ceilings',
    // Structural Columns
    'm_concrete-rectangular-column': 'structural columns',
    'concrete-rectangular-column': 'structural columns',
    'm_concrete-round-column': 'structural columns',
    // Structural Framing (beams)
    'm_concrete-rectangular beam': 'structural framing',
    'concrete-rectangular beam': 'structural framing',
    'precast-inverted tee': 'structural framing',
    // Stairs
    'cast-in-place stair': 'stairs', 'assembled stair': 'stairs',
    'precast stair': 'stairs',
    // Railings
    'baranda': 'railings',
    // Doors
    'puerta_contraplacada_13_cm': 'doors',
    'puerta aluminio_vt (cws)': 'doors',
    // Windows
    'system panel': 'windows',
    // Plumbing
    'incepa_avant': 'plumbing fixtures',
    'rejilla_sanitaria': 'plumbing fixtures',
  }

  // Load elements with null category
  const { data: elements, error } = await admin
    .from('bim_elementos')
    .select('id, familia, tipo')
    .eq('importacion_id', importacion_id)
    .is('revit_categoria_id', null)

  if (error) throw new Error(error.message)
  if (!elements?.length) return { message: 'No elements with null category found', updated: 0 }

  let updated = 0
  const resolved: Record<string, number> = {}
  const unresolved: string[] = []

  for (const el of elements) {
    const famLower = (el.familia || '').toLowerCase()

    // Try exact familia match
    let catName = familiaMap[famLower]

    // Try partial match on common prefixes
    if (!catName) {
      if (famLower.startsWith('basic wall') || famLower.includes('wall')) catName = 'walls'
      else if (famLower.startsWith('floor')) catName = 'floors'
      else if (famLower.includes('ceiling')) catName = 'ceilings'
      else if (famLower.includes('column')) catName = 'structural columns'
      else if (famLower.includes('beam') || famLower.includes('framing')) catName = 'structural framing'
      else if (famLower.includes('stair') || famLower.includes('escalera')) catName = 'stairs'
      else if (famLower.includes('railing') || famLower.includes('baranda')) catName = 'railings'
      else if (famLower.includes('puerta') || famLower.includes('door') || famLower.startsWith('m_d')) catName = 'doors'
      else if (famLower.includes('window') || famLower.includes('ventana')) catName = 'windows'
      else if (famLower.includes('inodoro') || famLower.includes('lavamano') || famLower.includes('ducha')
        || famLower.includes('incepa') || famLower.includes('celite') || famLower.includes('deca_')
        || famLower.includes('rejilla_sanitaria') || famLower.includes('chuveiro')) catName = 'plumbing fixtures'
      else if (famLower.includes('luminaria') || famLower.includes('electrical')) catName = 'electrical fixtures'
      else if (famLower.includes('mullion')) catName = 'walls'
    }

    const catId = catName ? catNameToId.get(catName) : undefined
    if (catId) {
      await admin.from('bim_elementos').update({ revit_categoria_id: catId }).eq('id', el.id)
      updated++
      resolved[catName!] = (resolved[catName!] || 0) + 1
    } else {
      const key = `${el.familia} / ${el.tipo}`
      if (!unresolved.includes(key)) unresolved.push(key)
    }
  }

  return {
    total_sin_categoria: elements.length,
    resueltos: updated,
    sin_resolver: elements.length - updated,
    por_categoria: resolved,
    familias_sin_resolver: unresolved,
    message: `Resolved ${updated}/${elements.length} elements`,
  }
}
