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

const importSchema = z.object({
  partida_ids: z.array(z.string().uuid()).min(1, 'Selecciona al menos una partida'),
})

const updatePartidaSchema = z.object({
  proyecto_partida_id: z.string().uuid(),
  metrado_manual: z.number().min(0).optional(),
  metrado_final: z.number().min(0).optional(),
  notas: z.string().optional().nullable(),
})

const deletePartidaSchema = z.object({
  proyecto_partida_id: z.string().uuid(),
})

// POST /api/proyectos/[id]/partidas — bulk import partidas from catalog
export async function POST(
  request: NextRequest,
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

    // Verify project exists and user has access
    const { data: proyecto } = await admin
      .from('proyectos')
      .select('id, propietario_id, org_id')
      .eq('id', proyectoId)
      .single()

    if (!proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Check access (owner or org member)
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
        return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
      }
    }

    const body = await request.json()
    const parsed = importSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const { partida_ids } = parsed.data

    // Get current max orden in project
    const { data: maxOrdenRow } = await admin
      .from('proyecto_partidas')
      .select('orden')
      .eq('proyecto_id', proyectoId)
      .order('orden', { ascending: false })
      .limit(1)
      .single()

    let nextOrden = (maxOrdenRow?.orden ?? 0) + 1

    // Filter out partidas that are already in the project
    const { data: existing } = await admin
      .from('proyecto_partidas')
      .select('partida_id')
      .eq('proyecto_id', proyectoId)
      .in('partida_id', partida_ids)

    const existingIds = new Set((existing ?? []).map((r: { partida_id: string }) => r.partida_id))
    const newIds = partida_ids.filter(id => !existingIds.has(id))

    if (newIds.length === 0) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        skipped: partida_ids.length,
        message: 'Todas las partidas ya están en el proyecto',
      })
    }

    // Fetch partidas with localizaciones for ordering by codigo_local
    const { data: partidasData } = await admin
      .from('partidas')
      .select('id, partida_localizaciones(codigo_local)')
      .in('id', newIds)

    // Sort by codigo_local to maintain logical order
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
      console.error('Insert partidas error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      imported: rows.length,
      skipped: existingIds.size,
      message: `${rows.length} partida${rows.length !== 1 ? 's' : ''} importada${rows.length !== 1 ? 's' : ''} al proyecto`,
    })
  } catch (error) {
    console.error('POST /api/proyectos/[id]/partidas error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Helper: verify user access to project
async function verifyAccess(proyectoId: string, userId: string) {
  const admin = getAdmin()
  const { data: proyecto } = await admin
    .from('proyectos')
    .select('id, propietario_id, org_id')
    .eq('id', proyectoId)
    .single()

  if (!proyecto) return false
  if (proyecto.propietario_id === userId) return true

  const { data: projMember } = await admin
    .from('proyecto_miembros')
    .select('id')
    .eq('proyecto_id', proyectoId)
    .eq('usuario_id', userId)
    .limit(1)
    .single()
  if (projMember) return true

  if (proyecto.org_id) {
    const { data: orgMember } = await admin
      .from('org_miembros')
      .select('id')
      .eq('org_id', proyecto.org_id)
      .eq('user_id', userId)
      .limit(1)
      .single()
    if (orgMember) return true
  }

  return false
}

// PATCH /api/proyectos/[id]/partidas — update a proyecto_partida (metrado, notas)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!(await verifyAccess(proyectoId, user.id))) {
      return NextResponse.json({ error: 'No tienes acceso' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updatePartidaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const { proyecto_partida_id, ...updates } = parsed.data
    const admin = getAdmin()

    // Build update object — only include provided fields
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.metrado_manual !== undefined) updateData.metrado_manual = updates.metrado_manual
    if (updates.metrado_final !== undefined) updateData.metrado_final = updates.metrado_final
    if (updates.notas !== undefined) updateData.notas = updates.notas

    const { data, error } = await admin
      .from('proyecto_partidas')
      .update(updateData)
      .eq('id', proyecto_partida_id)
      .eq('proyecto_id', proyectoId)
      .select('*, partidas(id, nombre, unidad, capitulo)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('PATCH /api/proyectos/[id]/partidas error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE /api/proyectos/[id]/partidas — remove a partida from project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!(await verifyAccess(proyectoId, user.id))) {
      return NextResponse.json({ error: 'No tienes acceso' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = deletePartidaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const admin = getAdmin()
    const { error } = await admin
      .from('proyecto_partidas')
      .delete()
      .eq('id', parsed.data.proyecto_partida_id)
      .eq('proyecto_id', proyectoId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/proyectos/[id]/partidas error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
