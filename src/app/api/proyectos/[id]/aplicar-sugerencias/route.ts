import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

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

// ============================================================
// POST /api/proyectos/[id]/aplicar-sugerencias
//
// Receives agent response text, extracts partida references,
// matches against catalog, returns candidates for user to confirm.
//
// Body: { texto: string, modo: "buscar" | "aplicar", partida_ids?: string[] }
//
// modo "buscar": parse text -> return matched partidas
// modo "aplicar": add selected partida_ids to project
// ============================================================

const buscarSchema = z.object({
  texto: z.string().min(10),
  modo: z.literal('buscar'),
})

const aplicarSchema = z.object({
  modo: z.literal('aplicar'),
  partida_ids: z.array(z.string().uuid()).min(1),
})

const requestSchema = z.discriminatedUnion('modo', [buscarSchema, aplicarSchema])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params

    // Auth
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = getAdmin()

    // Verify project exists
    const { data: proyecto } = await admin
      .from('proyectos')
      .select('id, pais_id, paises(codigo)')
      .eq('id', proyectoId)
      .single()

    if (!proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Datos invalidos' },
        { status: 400 }
      )
    }

    // ============================================================
    // MODO BUSCAR: extract partida names from agent text, match catalog
    // ============================================================
    if (parsed.data.modo === 'buscar') {
      const { texto } = parsed.data

      // Extract candidate partida names from agent markdown text
      const candidates = extractPartidaNames(texto)

      if (candidates.length === 0) {
        return NextResponse.json({
          matches: [],
          message: 'No se encontraron partidas en el texto del agente',
        })
      }

      // Get all catalog partidas (with localizaciones for the project's country)
      const { data: allPartidas } = await admin
        .from('partidas')
        .select('id, nombre, unidad, capitulo, partida_localizaciones(codigo_local, estandar_id, estandares(codigo))')
        .order('capitulo')
        .order('nombre')

      if (!allPartidas || allPartidas.length === 0) {
        return NextResponse.json({ matches: [], message: 'Catalogo vacio' })
      }

      // Get existing project partidas to mark them
      const { data: existingPP } = await admin
        .from('proyecto_partidas')
        .select('partida_id')
        .eq('proyecto_id', proyectoId)

      const existingSet = new Set((existingPP || []).map(e => e.partida_id))

      // Fuzzy match each candidate against catalog
      const matches: Array<{
        partida_id: string
        nombre: string
        unidad: string
        capitulo: string | null
        codigo_local: string | null
        score: number
        ya_en_proyecto: boolean
        texto_original: string
      }> = []

      const usedIds = new Set<string>()

      for (const candidate of candidates) {
        const normalizedCandidate = normalize(candidate.name)

        let bestMatch: typeof allPartidas[0] | null = null
        let bestScore = 0

        for (const partida of allPartidas) {
          if (usedIds.has(partida.id)) continue

          const normalizedNombre = normalize(partida.nombre)
          const score = similarityScore(normalizedCandidate, normalizedNombre)

          if (score > bestScore && score >= 0.35) {
            bestScore = score
            bestMatch = partida
          }
        }

        if (bestMatch && bestScore >= 0.35) {
          usedIds.add(bestMatch.id)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const locs = bestMatch.partida_localizaciones as any[]

          matches.push({
            partida_id: bestMatch.id,
            nombre: bestMatch.nombre,
            unidad: bestMatch.unidad,
            capitulo: bestMatch.capitulo,
            codigo_local: locs?.[0]?.codigo_local || null,
            score: Math.round(bestScore * 100),
            ya_en_proyecto: existingSet.has(bestMatch.id),
            texto_original: candidate.name,
          })
        }
      }

      // Sort: not-in-project first, then by score
      matches.sort((a, b) => {
        if (a.ya_en_proyecto !== b.ya_en_proyecto) return a.ya_en_proyecto ? 1 : -1
        return b.score - a.score
      })

      return NextResponse.json({
        matches,
        total_candidates: candidates.length,
        total_matched: matches.length,
        nuevas: matches.filter(m => !m.ya_en_proyecto).length,
      })
    }

    // ============================================================
    // MODO APLICAR: add selected partidas to project
    // ============================================================
    if (parsed.data.modo === 'aplicar') {
      const { partida_ids } = parsed.data

      // Get current max order
      const { data: maxRow } = await admin
        .from('proyecto_partidas')
        .select('orden')
        .eq('proyecto_id', proyectoId)
        .order('orden', { ascending: false })
        .limit(1)
        .single()

      let nextOrden = ((maxRow?.orden as number) ?? 0) + 1

      // Filter existing
      const { data: existing } = await admin
        .from('proyecto_partidas')
        .select('partida_id')
        .eq('proyecto_id', proyectoId)
        .in('partida_id', partida_ids)

      const existingSet = new Set((existing || []).map(e => e.partida_id))
      const newIds = partida_ids.filter(id => !existingSet.has(id))

      if (newIds.length === 0) {
        return NextResponse.json({
          imported: 0,
          skipped: partida_ids.length,
          message: 'Todas las partidas ya estan en el proyecto',
        })
      }

      // Get partidas with localizaciones for ordering
      const { data: partidasData } = await admin
        .from('partidas')
        .select('id, partida_localizaciones(codigo_local)')
        .in('id', newIds)

      const sorted = (partidasData ?? []).sort((a, b) => {
        const codeA = a.partida_localizaciones?.[0]?.codigo_local || '99.99'
        const codeB = b.partida_localizaciones?.[0]?.codigo_local || '99.99'
        return codeA.localeCompare(codeB, undefined, { numeric: true })
      })

      const rows = sorted.map(p => ({
        proyecto_id: proyectoId,
        partida_id: p.id,
        cantidad: 1,
        orden: nextOrden++,
      }))

      const { error: insertError } = await admin
        .from('proyecto_partidas')
        .insert(rows)

      if (insertError) throw new Error(insertError.message)

      return NextResponse.json({
        imported: rows.length,
        skipped: existingSet.size,
        message: `${rows.length} partida${rows.length !== 1 ? 's' : ''} agregada${rows.length !== 1 ? 's' : ''} al proyecto`,
      })
    }

    return NextResponse.json({ error: 'Modo no reconocido' }, { status: 400 })
  } catch (error) {
    console.error('POST aplicar-sugerencias error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

// ============================================================
// Text extraction helpers
// ============================================================

interface PartidaCandidate {
  name: string
  unit?: string
  chapter?: string
}

/**
 * Extract partida names from agent markdown response.
 * Handles formats like:
 * - "**[Capitulo]** Nombre de partida | unidad | razon"
 * - "- Nombre de partida (m2)"
 * - "1. Nombre de partida | m2"
 * - Lines containing typical construction terms
 */
function extractPartidaNames(text: string): PartidaCandidate[] {
  const candidates: PartidaCandidate[] = []
  const lines = text.split('\n')
  const seen = new Set<string>()

  for (const rawLine of lines) {
    // Strip markdown formatting
    const line = rawLine
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^#+\s*/, '')
      .replace(/^[-•]\s*/, '')
      .replace(/^\d+\.\s*/, '')
      .trim()

    if (!line || line.length < 5 || line.length > 200) continue

    // Skip header/explanation lines
    if (/^(para|cuando|nota|importante|el |la |los |las |si |no |te |se |hay|como|donde|que |es |son |tu |un |una )/i.test(line)) continue
    if (/^(paso|capitulo|seccion|agente|recuerda|advertencia|conclusion)/i.test(line)) continue

    // Pattern 1: "[Capitulo] Nombre | unidad | razon"
    const bracketMatch = line.match(/\[([^\]]+)\]\s*(.+)/)
    if (bracketMatch) {
      const chapter = bracketMatch[1].trim()
      const rest = bracketMatch[2].trim()
      const parts = rest.split('|').map(p => p.trim())
      if (parts[0] && isConstructionTerm(parts[0])) {
        const key = normalize(parts[0])
        if (!seen.has(key)) {
          seen.add(key)
          candidates.push({ name: parts[0], unit: parts[1], chapter })
        }
      }
      continue
    }

    // Pattern 2: "Nombre | unidad | ..."
    const pipeMatch = line.split('|').map(p => p.trim())
    if (pipeMatch.length >= 2 && isConstructionTerm(pipeMatch[0])) {
      const key = normalize(pipeMatch[0])
      if (!seen.has(key)) {
        seen.add(key)
        candidates.push({ name: pipeMatch[0], unit: pipeMatch[1] })
      }
      continue
    }

    // Pattern 3: "Nombre (unidad)" or "Nombre - descripcion"
    const parenMatch = line.match(/^(.+?)\s*\((m[23l]|kg|pza|glb|und|pto|m)\)/)
    if (parenMatch && isConstructionTerm(parenMatch[1])) {
      const key = normalize(parenMatch[1])
      if (!seen.has(key)) {
        seen.add(key)
        candidates.push({ name: parenMatch[1].trim(), unit: parenMatch[2] })
      }
      continue
    }

    // Pattern 4: Construction-specific line without explicit format
    if (isConstructionTerm(line) && line.split(' ').length <= 12) {
      // Remove trailing descriptions after dash
      const name = line.split(' - ')[0].split(' — ')[0].split(': ')[0].trim()
      if (name.length >= 8) {
        const key = normalize(name)
        if (!seen.has(key)) {
          seen.add(key)
          candidates.push({ name })
        }
      }
    }
  }

  return candidates
}

/** Check if text contains construction-related terms */
function isConstructionTerm(text: string): boolean {
  const terms = [
    'muro', 'pared', 'tabique', 'ladrillo', 'bloque',
    'columna', 'viga', 'losa', 'zapata', 'cimiento',
    'tarrajeo', 'revoque', 'enlucido', 'estuco',
    'piso', 'contrapiso', 'ceramica', 'porcelanato',
    'pintura', 'latex', 'esmalte', 'barniz',
    'puerta', 'ventana', 'vidrio', 'marco',
    'tuberia', 'sanitario', 'agua', 'desague', 'drenaje',
    'electrico', 'electrica', 'tablero', 'luminaria', 'salida',
    'excavacion', 'relleno', 'compactacion', 'eliminacion',
    'concreto', 'hormigon', 'encofrado', 'acero', 'fierro',
    'impermeabilizacion', 'cobertura', 'cubierta', 'canaleta',
    'escalera', 'baranda', 'pasamanos',
    'cielo raso', 'contrazocalo', 'zocalo',
    'instalacion', 'replanteo', 'limpieza', 'letrero',
    'carpinteria', 'metalica', 'madera',
    'gas', 'medidor', 'artefacto',
    'provision', 'colocacion', 'suministro',
  ]
  const lower = text.toLowerCase()
  return terms.some(term => lower.includes(term))
}

/** Normalize text for comparison */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Similarity score between two normalized strings (0-1) */
function similarityScore(a: string, b: string): number {
  const wordsA = a.split(' ').filter(w => w.length > 2)
  const wordsB = b.split(' ').filter(w => w.length > 2)

  if (wordsA.length === 0 || wordsB.length === 0) return 0

  // Count matching words (exact + partial)
  let exactMatches = 0
  let partialMatches = 0

  for (const wa of wordsA) {
    if (wordsB.includes(wa)) {
      exactMatches++
    } else if (wordsB.some(wb => wb.includes(wa) || wa.includes(wb))) {
      partialMatches++
    }
  }

  const totalA = wordsA.length
  const totalB = wordsB.length
  const maxLen = Math.max(totalA, totalB)

  // Weighted score: exact matches count more
  const score = (exactMatches * 1.0 + partialMatches * 0.5) / maxLen

  // Bonus for similar length (penalize very different lengths)
  const lengthRatio = Math.min(totalA, totalB) / Math.max(totalA, totalB)

  return score * 0.8 + lengthRatio * 0.2
}
