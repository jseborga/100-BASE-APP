import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const createProjectSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  pais_id: z.string().uuid('pais_id debe ser UUID'),
  tipologia: z.string().optional(),
  ubicacion: z.string().optional(),
})

const updateProjectSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  pais_id: z.string().uuid().optional(),
  tipologia: z.string().optional(),
  ubicacion: z.string().optional(),
  estado: z.enum(['activo', 'borrador', 'completado', 'archivado']).optional(),
})

// GET /api/proyectos — list projects visible to user
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Get user's org memberships
    const { data: orgRows } = await adminClient
      .from('org_miembros')
      .select('org_id')
      .eq('user_id', user.id)

    const orgIds = (orgRows ?? []).map((r: { org_id: string }) => r.org_id)

    // Build query: owned by user OR in user's orgs
    let query = adminClient
      .from('proyectos')
      .select('*, paises(id, codigo, nombre)')
      .order('created_at', { ascending: false })

    if (orgIds.length > 0) {
      query = query.or(`propietario_id.eq.${user.id},org_id.in.(${orgIds.join(',')})`)
    } else {
      query = query.eq('propietario_id', user.id)
    }

    const { data, error } = await query
    if (error) {
      console.error('DB error:', error)
      return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 })
    }

    // Count partidas per project
    const projectIds = (data ?? []).map((p: { id: string }) => p.id)
    const counts: Record<string, number> = {}
    if (projectIds.length > 0) {
      const { data: countData } = await adminClient
        .from('proyecto_partidas')
        .select('proyecto_id')
        .in('proyecto_id', projectIds)

      ;(countData ?? []).forEach((row: { proyecto_id: string }) => {
        counts[row.proyecto_id] = (counts[row.proyecto_id] || 0) + 1
      })
    }

    const projects = (data ?? []).map((p: Record<string, unknown>) => ({
      ...p,
      _count_partidas: counts[p.id as string] || 0,
    }))

    return NextResponse.json(projects)
  } catch (error) {
    console.error('GET /api/proyectos error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST /api/proyectos — create project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.errors },
        { status: 400 }
      )
    }

    // Get user's org
    const { data: orgRow } = await adminClient
      .from('org_miembros')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    const { nombre, descripcion, pais_id, tipologia, ubicacion } = parsed.data

    const { data: project, error } = await adminClient
      .from('proyectos')
      .insert({
        nombre,
        descripcion: descripcion || null,
        pais_id,
        tipologia: tipologia || null,
        ubicacion: ubicacion || null,
        propietario_id: user.id,
        org_id: orgRow?.org_id || null,
        estado: 'activo',
      })
      .select('*, paises(id, codigo, nombre)')
      .single()

    if (error) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: `Error al crear: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('POST /api/proyectos error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PUT /api/proyectos — update project
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const { id, ...updates } = parsed.data

    // Verify ownership
    const { data: existing } = await adminClient
      .from('proyectos')
      .select('propietario_id')
      .eq('id', id)
      .single()

    if (!existing || existing.propietario_id !== user.id) {
      return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })
    }

    const { data: project, error } = await adminClient
      .from('proyectos')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, paises(id, codigo, nombre)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('PUT /api/proyectos error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE /api/proyectos?id=xxx
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
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing } = await adminClient
      .from('proyectos')
      .select('propietario_id')
      .eq('id', id)
      .single()

    if (!existing || existing.propietario_id !== user.id) {
      return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })
    }

    // Delete related data
    await adminClient.from('proyecto_partidas').delete().eq('proyecto_id', id)
    await adminClient.from('proyecto_miembros').delete().eq('proyecto_id', id)

    const { error } = await adminClient.from('proyectos').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/proyectos error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}