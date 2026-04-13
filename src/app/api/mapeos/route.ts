import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: SupabaseClient<any> | null = null
function getAdminClient(): SupabaseClient<any> {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

// ============================================================
// Schemas
// ============================================================

const createMapeoSchema = z.object({
  revit_categoria_id: z.string().uuid(),
  partida_id: z.string().uuid(),
  formula: z.string().min(1, 'La fórmula es requerida'),
  parametro_principal: z.string().optional(),
  descripcion: z.string().optional(),
  instrucciones_computo: z.string().optional(),
  prioridad: z.number().int().min(0).default(0),
  condicion_filtro: z.string().optional(),
})

const updateMapeoSchema = z.object({
  id: z.string().uuid(),
  partida_id: z.string().uuid().optional(),
  formula: z.string().min(1).optional(),
  parametro_principal: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  instrucciones_computo: z.string().optional().nullable(),
  prioridad: z.number().int().min(0).optional(),
  condicion_filtro: z.string().optional().nullable(),
})

// ============================================================
// Formula validation
// ============================================================

function evaluateFormula(formula: string, params: Record<string, number>): number | null {
  try {
    let expr = formula
    const sortedKeys = Object.keys(params).sort((a, b) => b.length - a.length)
    for (const key of sortedKeys) {
      expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), String(params[key]))
    }
    // Only allow numbers, operators, parentheses, spaces
    if (/[^0-9+\-*/().eE\s]/.test(expr)) return null
    const result = Function(`"use strict"; return (${expr})`)()
    return typeof result === 'number' && isFinite(result) ? result : null
  } catch {
    return null
  }
}

// ============================================================
// GET /api/mapeos — list all mapeos with joins
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = getAdminClient()
    const { searchParams } = new URL(request.url)
    const categoriaId = searchParams.get('categoria_id')

    let query = admin
      .from('revit_mapeos')
      .select(`
        id, formula, parametro_principal, descripcion, prioridad,
        instrucciones_computo, condicion_filtro,
        revit_categoria_id,
        revit_categorias(id, nombre, nombre_es, parametros_clave),
        partida_id,
        partidas(id, nombre, unidad, capitulo)
      `)
      .order('revit_categoria_id')
      .order('prioridad', { ascending: true })

    if (categoriaId) {
      query = query.eq('revit_categoria_id', categoriaId)
    }

    const { data: mapeos, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also fetch all categories (for the "add" dropdown)
    const { data: categorias } = await admin
      .from('revit_categorias')
      .select('id, nombre, nombre_es, parametros_clave')
      .order('nombre')

    // Fetch sample Revit params per category from real bim_elementos
    const { data: sampleElements } = await admin
      .from('bim_elementos')
      .select('revit_categoria_id, familia, tipo, parametros')
      .not('revit_categoria_id', 'is', null)
      .limit(500)

    // Group samples by category — pick 3 unique familia+tipo combos
    const samplesByCategory: Record<string, Array<{
      familia: string
      tipo: string
      parametros: Record<string, unknown>
    }>> = {}

    for (const el of sampleElements || []) {
      const catId = el.revit_categoria_id as string
      if (!samplesByCategory[catId]) samplesByCategory[catId] = []
      const arr = samplesByCategory[catId]
      const key = `${el.familia}::${el.tipo}`
      if (arr.length < 3 && !arr.some(s => `${s.familia}::${s.tipo}` === key)) {
        arr.push({
          familia: el.familia || '',
          tipo: el.tipo || '',
          parametros: el.parametros as Record<string, unknown>,
        })
      }
    }

    return NextResponse.json({
      mapeos: mapeos || [],
      categorias: categorias || [],
      samples: samplesByCategory,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/mapeos — create a new mapeo
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createMapeoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Validate formula
    const testParams: Record<string, number> = {
      Area: 100, AreaBruta: 110, AreaBrutaExt: 100, AreaExt: 100,
      OpeningsArea: 10, OpeningsAreaTotal: 15, OpeningsAreaNoDesc: 5,
      Volume: 10, Length: 5, Height: 3, Width: 0.2, Count: 1,
      Cantidad: 1, CantidadPrincipal: 1, CantidadConDesperdicio: 1.05,
      FactorDesperdicio: 0.05, PesoLinealKgM: 2.5, PesoTotalKg: 12.5,
      RevEspInt: 0.015, RevEspExt: 0.02, CeramicaAltura: 1.8,
    }
    const testResult = evaluateFormula(parsed.data.formula, testParams)
    if (testResult === null) {
      return NextResponse.json(
        { error: `Fórmula inválida: "${parsed.data.formula}". Use parámetros como Area, Volume, Count, etc.` },
        { status: 400 }
      )
    }

    const admin = getAdminClient()
    const { data, error } = await admin
      .from('revit_mapeos')
      .insert({
        revit_categoria_id: parsed.data.revit_categoria_id,
        partida_id: parsed.data.partida_id,
        formula: parsed.data.formula,
        parametro_principal: parsed.data.parametro_principal || null,
        descripcion: parsed.data.descripcion || null,
        instrucciones_computo: parsed.data.instrucciones_computo || null,
        prioridad: parsed.data.prioridad,
        condicion_filtro: parsed.data.condicion_filtro || null,
      })
      .select(`
        id, formula, parametro_principal, descripcion, prioridad,
        instrucciones_computo, condicion_filtro,
        revit_categoria_id,
        revit_categorias(id, nombre, nombre_es, parametros_clave),
        partida_id,
        partidas(id, nombre, unidad, capitulo)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT /api/mapeos — update a mapeo
// ============================================================

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateMapeoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { id, ...fields } = parsed.data
    const updates: Record<string, unknown> = {}

    if (fields.formula !== undefined) {
      const testParams: Record<string, number> = {
        Area: 100, AreaBruta: 110, AreaBrutaExt: 100, AreaExt: 100,
        OpeningsArea: 10, Volume: 10, Length: 5, Height: 3, Width: 0.2, Count: 1,
      }
      if (evaluateFormula(fields.formula, testParams) === null) {
        return NextResponse.json(
          { error: `Fórmula inválida: "${fields.formula}"` },
          { status: 400 }
        )
      }
      updates.formula = fields.formula
    }
    if (fields.partida_id !== undefined) updates.partida_id = fields.partida_id
    if (fields.parametro_principal !== undefined) updates.parametro_principal = fields.parametro_principal
    if (fields.descripcion !== undefined) updates.descripcion = fields.descripcion
    if (fields.instrucciones_computo !== undefined) updates.instrucciones_computo = fields.instrucciones_computo
    if (fields.prioridad !== undefined) updates.prioridad = fields.prioridad
    if (fields.condicion_filtro !== undefined) updates.condicion_filtro = fields.condicion_filtro

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
    }

    const admin = getAdminClient()
    const { data, error } = await admin
      .from('revit_mapeos')
      .update(updates)
      .eq('id', id)
      .select(`
        id, formula, parametro_principal, descripcion, prioridad,
        instrucciones_computo, condicion_filtro,
        revit_categoria_id,
        revit_categorias(id, nombre, nombre_es, parametros_clave),
        partida_id,
        partidas(id, nombre, unidad, capitulo)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/mapeos?id=<uuid> — delete a mapeo
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
    }

    const admin = getAdminClient()
    const { error } = await admin
      .from('revit_mapeos')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}
