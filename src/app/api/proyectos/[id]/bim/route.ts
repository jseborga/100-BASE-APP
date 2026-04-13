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
        metrado_calculado, estado, formula_usada, notas_mapeo,
        partida_codigo, partida_nombre,
        revit_categorias(id, nombre, nombre_es),
        partidas(id, nombre, unidad, capitulo)
      `)
      .eq('importacion_id', latestImportId)
      .order('familia')
      .order('tipo')

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

// PUT /api/proyectos/[id]/bim — Map a group of elements (same familia+tipo) at once
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params
  const admin = getAdmin()

  try {
    const body = await request.json()
    const { importacion_id, revit_categoria_id, familia, tipo, partida_id, formula } = body

    if (!importacion_id || !partida_id || !formula) {
      return NextResponse.json(
        { error: 'importacion_id, partida_id y formula son requeridos' },
        { status: 400 }
      )
    }

    // Build query for matching elements
    let query = admin
      .from('bim_elementos')
      .select('id, parametros')
      .eq('importacion_id', importacion_id)

    if (revit_categoria_id) query = query.eq('revit_categoria_id', revit_categoria_id)
    if (familia) query = query.eq('familia', familia)
    if (tipo) query = query.eq('tipo', tipo)

    const { data: elements, error: fetchErr } = await query
    if (fetchErr) throw new Error(fetchErr.message)
    if (!elements || elements.length === 0) {
      return NextResponse.json({ error: 'No se encontraron elementos' }, { status: 404 })
    }

    // Get partida info for write-back fields
    const { data: partida } = await admin
      .from('partidas')
      .select('nombre, unidad')
      .eq('id', partida_id)
      .single()

    // Get localización code if available
    let partidaCodigo: string | null = null
    if (partida) {
      const { data: loc } = await admin
        .from('partida_localizaciones')
        .select('codigo_local')
        .eq('partida_id', partida_id)
        .limit(1)
        .maybeSingle()
      if (loc) partidaCodigo = loc.codigo_local
    }

    // Evaluate formula for each element and update
    let mapped = 0
    let errors = 0

    for (const el of elements) {
      const params = (el.parametros || {}) as Record<string, number>
      const metrado = evaluateFormula(formula, params)

      if (metrado !== null) {
        const { error: updateErr } = await admin
          .from('bim_elementos')
          .update({
            partida_id: partida_id,
            metrado_calculado: Math.round(metrado * 10000) / 10000,
            formula_usada: formula,
            estado: 'mapeado',
            partida_nombre: partida?.nombre || null,
            partida_codigo: partidaCodigo,
          })
          .eq('id', el.id)

        if (updateErr) errors++
        else mapped++
      } else {
        // Formula didn't evaluate — mark as sin_match
        await admin
          .from('bim_elementos')
          .update({ estado: 'sin_match', formula_usada: formula })
          .eq('id', el.id)
        errors++
      }
    }

    return NextResponse.json({ mapped, errors, total: elements.length })
  } catch (err) {
    console.error('BIM PUT error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error mapping group' },
      { status: 500 }
    )
  }
}

function evaluateFormula(formula: string, params: Record<string, number>): number | null {
  try {
    let expr = formula
    const sortedKeys = Object.keys(params).sort((a, b) => b.length - a.length)
    for (const key of sortedKeys) {
      const val = typeof params[key] === 'number' ? params[key] : parseFloat(String(params[key]))
      if (!isNaN(val)) {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val))
      }
    }
    // Only allow numbers, operators, parentheses, spaces
    if (/[^0-9+\-*/().eE\s]/.test(expr)) return null
    const result = Function(`"use strict"; return (${expr})`)()
    return typeof result === 'number' && isFinite(result) ? result : null
  } catch {
    return null
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
