import { NextRequest, NextResponse } from 'next/server'
import { getAdmin } from '@/lib/webhooks/auth'

// GET /api/proyectos/[id]/bim — BIM imports + elements for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proyectoId } = await params
  const admin = getAdmin()

  try {
    // Get imports for this project
    const { data: imports, error: impErr } = await admin
      .from('bim_importaciones')
      .select('id, archivo_nombre, total_elementos, estado, created_at')
      .eq('proyecto_id', proyectoId)
      .order('created_at', { ascending: false })

    if (impErr) throw new Error(impErr.message)

    // If no imports, return empty
    if (!imports || imports.length === 0) {
      return NextResponse.json({ imports: [], elements: [], count: 0 })
    }

    // Get elements for the latest import (with partida info)
    const latestImportId = imports[0].id
    const { data: elements, error: elemErr } = await admin
      .from('bim_elementos')
      .select(`
        id, revit_id, familia, tipo, parametros,
        metrado_calculado, estado,
        revit_categorias(id, nombre, nombre_es),
        partidas(id, nombre, unidad, capitulo)
      `)
      .eq('importacion_id', latestImportId)
      .order('revit_id')

    if (elemErr) throw new Error(elemErr.message)

    return NextResponse.json({
      imports,
      elements: elements || [],
      count: elements?.length || 0,
      latest_import_id: latestImportId,
    })
  } catch (err) {
    console.error('BIM GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error loading BIM data' },
      { status: 500 }
    )
  }
}

// PATCH /api/proyectos/[id]/bim — Update element match (override partida or metrado)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params // validate route
  const admin = getAdmin()

  try {
    const body = await request.json()
    const { elemento_id, partida_id, metrado_override, estado } = body

    if (!elemento_id) {
      return NextResponse.json({ error: 'elemento_id is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (partida_id !== undefined) updates.partida_id = partida_id
    if (metrado_override !== undefined) updates.metrado_calculado = metrado_override
    if (estado) updates.estado = estado

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('bim_elementos')
      .update(updates)
      .eq('id', elemento_id)
      .select('id, estado, metrado_calculado, partida_id')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ element: data })
  } catch (err) {
    console.error('BIM PATCH error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error updating element' },
      { status: 500 }
    )
  }
}

// POST /api/proyectos/[id]/bim — Confirm matched elements → create proyecto_partidas
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proyectoId } = await params
  const admin = getAdmin()

  try {
    const body = await request.json()
    const { importacion_id, elemento_ids } = body

    if (!importacion_id) {
      return NextResponse.json({ error: 'importacion_id is required' }, { status: 400 })
    }

    // Get matched elements to confirm
    let query = admin
      .from('bim_elementos')
      .select('id, partida_id, metrado_calculado, estado')
      .eq('importacion_id', importacion_id)
      .eq('estado', 'mapeado')
      .not('partida_id', 'is', null)
      .not('metrado_calculado', 'is', null)

    if (elemento_ids && elemento_ids.length > 0) {
      query = query.in('id', elemento_ids)
    }

    const { data: elements, error: fetchErr } = await query
    if (fetchErr) throw new Error(fetchErr.message)
    if (!elements || elements.length === 0) {
      return NextResponse.json({ error: 'No matched elements to confirm' }, { status: 400 })
    }

    // Aggregate metrados by partida_id
    const aggregated = new Map<string, number>()
    for (const el of elements) {
      const current = aggregated.get(el.partida_id) || 0
      aggregated.set(el.partida_id, current + (el.metrado_calculado || 0))
    }

    let created = 0
    let updated = 0

    // Upsert proyecto_partidas
    for (const [partidaId, metrado] of aggregated) {
      const { data: existing } = await admin
        .from('proyecto_partidas')
        .select('id')
        .eq('proyecto_id', proyectoId)
        .eq('partida_id', partidaId)
        .maybeSingle()

      if (existing) {
        await admin
          .from('proyecto_partidas')
          .update({
            metrado_bim: Math.round(metrado * 10000) / 10000,
            metrado_final: Math.round(metrado * 10000) / 10000,
          })
          .eq('id', existing.id)
        updated++
      } else {
        await admin
          .from('proyecto_partidas')
          .insert({
            proyecto_id: proyectoId,
            partida_id: partidaId,
            metrado_bim: Math.round(metrado * 10000) / 10000,
            metrado_final: Math.round(metrado * 10000) / 10000,
            cantidad: 1,
          })
        created++
      }
    }

    // Mark elements as confirmed
    const elementIds = elements.map(e => e.id)
    await admin
      .from('bim_elementos')
      .update({ estado: 'confirmado' })
      .in('id', elementIds)

    // Update import status
    await admin
      .from('bim_importaciones')
      .update({ estado: 'confirmado' })
      .eq('id', importacion_id)

    return NextResponse.json({
      created,
      updated,
      total_partidas: created + updated,
      message: `${created} partidas created, ${updated} updated with BIM metrados`,
    })
  } catch (err) {
    console.error('BIM POST error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error confirming BIM match' },
      { status: 500 }
    )
  }
}
