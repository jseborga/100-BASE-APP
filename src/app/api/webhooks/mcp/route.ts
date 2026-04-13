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
  get_revit_mapeos: handleGetRevitMapeos,
  import_bim_elements: handleImportBimElements,
  match_bim_elements: handleMatchBimElements,
  confirm_bim_match: handleConfirmBimMatch,
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
    categoria: string
    familia: string
    tipo: string
    parametros: Record<string, number>
  }>

  if (!proyecto_id) throw new Error('proyecto_id is required')
  if (!elementos?.length) throw new Error('elementos array is required')

  // Load all revit categories for name→id resolution
  const { data: categorias } = await admin
    .from('revit_categorias')
    .select('id, nombre')

  const catMap = new Map((categorias || []).map(c => [c.nombre, c.id]))

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
  const rows = elementos.map(e => ({
    importacion_id: importacion.id,
    revit_id: e.revit_id || null,
    revit_categoria_id: catMap.get(e.categoria) || null,
    familia: e.familia || null,
    tipo: e.tipo || null,
    parametros: e.parametros || {},
    estado: 'pendiente' as const,
  }))

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

  // Load all mapeos grouped by category
  const { data: mapeos } = await admin
    .from('revit_mapeos')
    .select('id, revit_categoria_id, partida_id, formula, parametro_principal, prioridad')
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

    const paramData = (elem.parametros || {}) as Record<string, number>
    let firstDone = false

    for (const mapeo of catMapeos) {
      const result = evaluateFormula(mapeo.formula, paramData)
      if (result === null || result <= 0) continue

      if (!firstDone) {
        // Update original element with first matching mapeo
        await admin.from('bim_elementos').update({
          partida_id: mapeo.partida_id,
          metrado_calculado: result,
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
