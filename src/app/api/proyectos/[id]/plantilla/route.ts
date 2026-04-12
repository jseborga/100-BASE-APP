import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: SupabaseClient<any> | null = null
function getAdmin(): SupabaseClient<any> {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

// Map UI tipologia values to tag dimension tipo_proyecto
const TIPOLOGIA_TO_TAG: Record<string, string[]> = {
  'Residencial Unifamiliar': ['residencial_unifamiliar'],
  'Residencial Multifamiliar': ['residencial_multifamiliar'],
  'Comercial': ['comercial', 'remodelacion_comercial'],
  'Industrial': ['industrial'],
  'Educación': ['educativo'],
  'Salud': ['salud'],
  'Oficinas': ['comercial'],
  'Infraestructura Vial': ['civil_vial'],
}

// GET /api/proyectos/[id]/plantilla — preview how many partidas would be loaded
// POST /api/proyectos/[id]/plantilla — load template partidas into project
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = getAdmin()

    // Get project with country
    const { data: proyecto } = await admin
      .from('proyectos')
      .select('id, tipologia, pais_id, propietario_id, org_id, paises(codigo)')
      .eq('id', proyectoId)
      .single()

    if (!proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    if (!proyecto.tipologia) {
      return NextResponse.json({ error: 'El proyecto no tiene tipología definida' }, { status: 400 })
    }

    const tagValues = TIPOLOGIA_TO_TAG[proyecto.tipologia]
    if (!tagValues) {
      return NextResponse.json({
        error: `No hay plantilla disponible para "${proyecto.tipologia}"`,
      }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paisCode = Array.isArray(proyecto.paises) ? (proyecto.paises as any[])[0]?.codigo : (proyecto.paises as any)?.codigo
    const candidateIds = await queryPlantillaPartidas(admin, tagValues, paisCode)

    // Check which are already in the project
    const { data: existing } = await admin
      .from('proyecto_partidas')
      .select('partida_id')
      .eq('proyecto_id', proyectoId)

    const existingIds = new Set((existing ?? []).map((r: { partida_id: string }) => r.partida_id))
    const newIds = candidateIds.filter(id => !existingIds.has(id))

    return NextResponse.json({
      tipologia: proyecto.tipologia,
      pais: paisCode,
      total_candidatas: candidateIds.length,
      ya_en_proyecto: existingIds.size,
      nuevas: newIds.length,
    })
  } catch (error) {
    console.error('GET /api/proyectos/[id]/plantilla error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = getAdmin()

    // Get project with country
    const { data: proyecto } = await admin
      .from('proyectos')
      .select('id, tipologia, pais_id, propietario_id, org_id, paises(codigo)')
      .eq('id', proyectoId)
      .single()

    if (!proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Verify access
    if (proyecto.propietario_id !== user.id) {
      let hasAccess = false

      const { data: projMember } = await admin
        .from('proyecto_miembros')
        .select('id')
        .eq('proyecto_id', proyectoId)
        .eq('usuario_id', user.id)
        .limit(1)
        .single()
      if (projMember) hasAccess = true

      if (!hasAccess && proyecto.org_id) {
        const { data: orgMember } = await admin
          .from('org_miembros')
          .select('id')
          .eq('org_id', proyecto.org_id)
          .eq('user_id', user.id)
          .limit(1)
          .single()
        if (orgMember) hasAccess = true
      }

      if (!hasAccess) {
        return NextResponse.json({ error: 'No tienes acceso' }, { status: 403 })
      }
    }

    if (!proyecto.tipologia) {
      return NextResponse.json({ error: 'El proyecto no tiene tipología definida' }, { status: 400 })
    }

    const tagValues = TIPOLOGIA_TO_TAG[proyecto.tipologia]
    if (!tagValues) {
      return NextResponse.json({
        error: `No hay plantilla disponible para "${proyecto.tipologia}"`,
      }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paisCode = Array.isArray(proyecto.paises) ? (proyecto.paises as any[])[0]?.codigo : (proyecto.paises as any)?.codigo
    const candidateIds = await queryPlantillaPartidas(admin, tagValues, paisCode)

    if (candidateIds.length === 0) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        message: 'No se encontraron partidas para esta tipología y país',
      })
    }

    // Filter out already-existing partidas
    const { data: existing } = await admin
      .from('proyecto_partidas')
      .select('partida_id')
      .eq('proyecto_id', proyectoId)

    const existingIds = new Set((existing ?? []).map((r: { partida_id: string }) => r.partida_id))
    const newIds = candidateIds.filter(id => !existingIds.has(id))

    if (newIds.length === 0) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        skipped: candidateIds.length,
        message: 'Todas las partidas de la plantilla ya están en el proyecto',
      })
    }

    // Get current max orden
    const { data: maxOrdenRow } = await admin
      .from('proyecto_partidas')
      .select('orden')
      .eq('proyecto_id', proyectoId)
      .order('orden', { ascending: false })
      .limit(1)
      .single()

    let nextOrden = (maxOrdenRow?.orden ?? 0) + 1

    // Fetch partidas with localizaciones for ordering by codigo_local
    const { data: partidasData } = await admin
      .from('partidas')
      .select('id, partida_localizaciones(codigo_local)')
      .in('id', newIds)

    // Sort by codigo_local for logical chapter order
    const sorted = (partidasData ?? []).sort((a, b) => {
      const codeA = a.partida_localizaciones?.[0]?.codigo_local || '99.99'
      const codeB = b.partida_localizaciones?.[0]?.codigo_local || '99.99'
      return codeA.localeCompare(codeB, undefined, { numeric: true })
    })

    // Build insert rows
    const rows = sorted.map(p => ({
      proyecto_id: proyectoId,
      partida_id: p.id,
      cantidad: 1,
      metrado_manual: null,
      metrado_bim: null,
      metrado_final: null,
      notas: null,
      orden: nextOrden++,
    }))

    const { error: insertError } = await admin
      .from('proyecto_partidas')
      .insert(rows)

    if (insertError) {
      console.error('Insert plantilla error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      imported: rows.length,
      skipped: existingIds.size,
      message: `Plantilla cargada: ${rows.length} partida${rows.length !== 1 ? 's' : ''} agregada${rows.length !== 1 ? 's' : ''} al proyecto`,
    })
  } catch (error) {
    console.error('POST /api/proyectos/[id]/plantilla error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * Query partidas matching tipologia tags + country + frecuencia (muy_comun, comun).
 * Returns partida IDs sorted by relevance (most tag matches first).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function queryPlantillaPartidas(admin: SupabaseClient<any>, tipologiaTags: string[], paisCode: string | null): Promise<string[]> {
  // Build the list of tag values to match
  const tagValues = [
    ...tipologiaTags,     // tipo_proyecto tags
    'muy_comun', 'comun', // frecuencia: only common partidas
  ]
  if (paisCode) tagValues.push(paisCode) // pais tag

  // Get tag IDs
  const { data: tags } = await admin
    .from('tags')
    .select('id, valor, dimension')
    .in('valor', tagValues)

  if (!tags || tags.length === 0) return []

  const tagIds = tags.map((t: { id: string }) => t.id)

  // Get partida_ids that match at least one tipo_proyecto tag AND frecuencia
  const { data: matches } = await admin
    .from('partida_tags')
    .select('partida_id, tag_id')
    .in('tag_id', tagIds)

  if (!matches || matches.length === 0) return []

  // Group by partida_id and count matched dimensions
  const tipologiaTagIds = new Set(tags.filter((t: { dimension: string }) => t.dimension === 'tipo_proyecto').map((t: { id: string }) => t.id))
  const frecuenciaTagIds = new Set(tags.filter((t: { dimension: string }) => t.dimension === 'frecuencia').map((t: { id: string }) => t.id))
  const paisTagIds = new Set(tags.filter((t: { dimension: string }) => t.dimension === 'pais').map((t: { id: string }) => t.id))

  const partidaScores: Record<string, { tipologia: boolean; frecuencia: boolean; pais: boolean; score: number }> = {}

  for (const m of matches) {
    if (!partidaScores[m.partida_id]) {
      partidaScores[m.partida_id] = { tipologia: false, frecuencia: false, pais: false, score: 0 }
    }
    const entry = partidaScores[m.partida_id]
    if (tipologiaTagIds.has(m.tag_id)) { entry.tipologia = true; entry.score += 3 }
    if (frecuenciaTagIds.has(m.tag_id)) { entry.frecuencia = true; entry.score += 2 }
    if (paisTagIds.has(m.tag_id)) { entry.pais = true; entry.score += 1 }
  }

  // Filter: must have tipo_proyecto match AND frecuencia match
  // If country data exists, also require country match
  const filtered = Object.entries(partidaScores)
    .filter(([, s]) => s.tipologia && s.frecuencia && (paisCode ? s.pais : true))
    .sort(([, a], [, b]) => b.score - a.score)
    .map(([id]) => id)

  return filtered
}
