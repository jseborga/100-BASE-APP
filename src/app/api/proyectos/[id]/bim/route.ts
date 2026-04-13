import { NextRequest, NextResponse } from 'next/server'
import { getAdmin } from '@/lib/webhooks/auth'

// ============================================================
// GET /api/proyectos/[id]/bim — BIM imports + elements
//   ?import_id=xxx  → elements for that import (default: latest)
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proyectoId } = await params
  const admin = getAdmin()

  try {
    const { searchParams } = new URL(request.url)
    const requestedImportId = searchParams.get('import_id')

    // Get ALL imports for this project
    const { data: imports, error: impErr } = await admin
      .from('bim_importaciones')
      .select('id, archivo_nombre, total_elementos, elementos_mapeados, estado, created_at')
      .eq('proyecto_id', proyectoId)
      .order('created_at', { ascending: false })

    if (impErr) throw new Error(impErr.message)

    if (!imports || imports.length === 0) {
      return NextResponse.json({ imports: [], elements: [], count: 0 })
    }

    // Pick which import to show: requested or latest
    const activeImportId = requestedImportId || imports[0].id

    // Get elements for the active import
    const { data: elements, error: elemErr } = await admin
      .from('bim_elementos')
      .select(`
        id, revit_id, revit_categoria_id, familia, tipo, parametros,
        metrado_calculado, estado, formula_usada, notas_mapeo,
        partida_codigo, partida_nombre,
        revit_categorias(id, nombre, nombre_es),
        partidas(id, nombre, unidad, capitulo)
      `)
      .eq('importacion_id', activeImportId)
      .order('familia')
      .order('tipo')

    if (elemErr) throw new Error(elemErr.message)

    // Get category IDs for suggested formulas
    const categoryIds = [...new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (elements || []).map((e: any) => e.revit_categoria_id).filter(Boolean)
    )] as string[]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let suggestedMapeos: any[] = []
    if (categoryIds.length > 0) {
      const { data: mapeos } = await admin
        .from('revit_mapeos')
        .select(`
          id, revit_categoria_id, formula, parametro_principal,
          descripcion, condicion_filtro, partida_id,
          partidas(id, nombre, unidad, capitulo)
        `)
        .in('revit_categoria_id', categoryIds)
        .order('revit_categoria_id')
        .order('prioridad', { ascending: true })

      suggestedMapeos = (mapeos || []).map((m: Record<string, unknown>) => ({
        ...m,
        partidas: Array.isArray(m.partidas) ? m.partidas[0] || null : m.partidas,
      }))
    }

    return NextResponse.json({
      imports,
      elements: elements || [],
      count: elements?.length || 0,
      active_import_id: activeImportId,
      suggested_mapeos: suggestedMapeos,
    })
  } catch (err) {
    console.error('BIM GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error loading BIM data' },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH /api/proyectos/[id]/bim — Update elements or reset mappings
//
//  action: 'update'       → update single element (default)
//  action: 'reset_group'  → release mapping for a group (familia+tipo)
//  action: 'reset_import' → release ALL mappings in an import
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params
  const admin = getAdmin()

  try {
    const body = await request.json()
    const action = body.action || 'update'

    // --- Reset a group of elements back to pendiente ---
    if (action === 'reset_group') {
      const { importacion_id, revit_categoria_id, familia, tipo } = body
      if (!importacion_id) {
        return NextResponse.json({ error: 'importacion_id requerido' }, { status: 400 })
      }

      let query = admin
        .from('bim_elementos')
        .update({
          partida_id: null,
          metrado_calculado: null,
          formula_usada: null,
          partida_nombre: null,
          partida_codigo: null,
          notas_mapeo: null,
          estado: 'pendiente',
        })
        .eq('importacion_id', importacion_id)

      if (revit_categoria_id) query = query.eq('revit_categoria_id', revit_categoria_id)
      if (familia) query = query.eq('familia', familia)
      if (tipo) query = query.eq('tipo', tipo)

      const { error, count } = await query.select('id')
      if (error) throw new Error(error.message)

      return NextResponse.json({ reset: count || 0, message: `${count || 0} elementos liberados` })
    }

    // --- Reset ALL elements in an import ---
    if (action === 'reset_import') {
      const { importacion_id } = body
      if (!importacion_id) {
        return NextResponse.json({ error: 'importacion_id requerido' }, { status: 400 })
      }

      const { error, count } = await admin
        .from('bim_elementos')
        .update({
          partida_id: null,
          metrado_calculado: null,
          formula_usada: null,
          partida_nombre: null,
          partida_codigo: null,
          notas_mapeo: null,
          estado: 'pendiente',
        })
        .eq('importacion_id', importacion_id)
        .select('id')

      if (error) throw new Error(error.message)

      // Reset import status too
      await admin
        .from('bim_importaciones')
        .update({ estado: 'pendiente', elementos_mapeados: 0 })
        .eq('id', importacion_id)

      return NextResponse.json({ reset: count || 0, message: `${count || 0} elementos liberados` })
    }

    // --- Default: update single element ---
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
      { error: err instanceof Error ? err.message : 'Error updating' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT /api/proyectos/[id]/bim — Map a group of elements at once
// ============================================================

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

    // Get partida info
    const { data: partida } = await admin
      .from('partidas')
      .select('nombre, unidad')
      .eq('id', partida_id)
      .single()

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
    if (/[^0-9+\-*/().eE\s]/.test(expr)) return null
    const result = Function(`"use strict"; return (${expr})`)()
    return typeof result === 'number' && isFinite(result) ? result : null
  } catch {
    return null
  }
}

// ============================================================
// POST /api/proyectos/[id]/bim — Confirm matched → proyecto_partidas
// ============================================================

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

    const aggregated = new Map<string, number>()
    for (const el of elements) {
      const current = aggregated.get(el.partida_id) || 0
      aggregated.set(el.partida_id, current + (el.metrado_calculado || 0))
    }

    let created = 0
    let updated = 0

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

    const elementIds = elements.map(e => e.id)
    await admin
      .from('bim_elementos')
      .update({ estado: 'confirmado' })
      .in('id', elementIds)

    await admin
      .from('bim_importaciones')
      .update({ estado: 'confirmado' })
      .eq('id', importacion_id)

    return NextResponse.json({
      created,
      updated,
      total_partidas: created + updated,
      message: `${created} partidas creadas, ${updated} actualizadas`,
    })
  } catch (err) {
    console.error('BIM POST error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error confirming BIM match' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/proyectos/[id]/bim?import_id=xxx — Delete an import
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: proyectoId } = await params
  const admin = getAdmin()

  try {
    const { searchParams } = new URL(request.url)
    const importId = searchParams.get('import_id')

    if (!importId) {
      return NextResponse.json({ error: 'import_id es requerido' }, { status: 400 })
    }

    // Verify import belongs to this project
    const { data: imp } = await admin
      .from('bim_importaciones')
      .select('id')
      .eq('id', importId)
      .eq('proyecto_id', proyectoId)
      .maybeSingle()

    if (!imp) {
      return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 })
    }

    // Elements are deleted via CASCADE
    const { error } = await admin
      .from('bim_importaciones')
      .delete()
      .eq('id', importId)

    if (error) throw new Error(error.message)

    return NextResponse.json({ deleted: true, message: 'Importación eliminada' })
  } catch (err) {
    console.error('BIM DELETE error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error deleting import' },
      { status: 500 }
    )
  }
}
