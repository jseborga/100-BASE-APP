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

const createPartidaSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  unidad: z.string().min(1, 'Unidad requerida'),
  capitulo: z.string().optional(),
  descripcion: z.string().optional(),
  proyecto_id: z.string().uuid().optional(),
})

// POST /api/partidas — create a new partida in the catalog + optionally add to a project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createPartidaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const admin = getAdmin()
    const { nombre, unidad, capitulo, descripcion, proyecto_id } = parsed.data

    // Create the partida in the catalog
    const { data: partida, error: insertError } = await admin
      .from('partidas')
      .insert({
        nombre,
        unidad,
        capitulo: capitulo || null,
        descripcion: descripcion || null,
        tipo: 'obra',
        es_compuesta: false,
      })
      .select('id, nombre, unidad, capitulo')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Also log it as a suggestion for review
    await admin.from('partida_sugerencias').insert({
      nombre_sugerido: nombre,
      unidad_sugerida: unidad,
      descripcion: descripcion || null,
      origen: 'usuario',
      contexto: { capitulo, proyecto_id },
      estado: 'aprobada',
      partida_creada_id: partida.id,
      sugerido_por: user.id,
    })

    // If proyecto_id provided, also add to that project
    let addedToProject = false
    if (proyecto_id) {
      const { data: maxOrden } = await admin
        .from('proyecto_partidas')
        .select('orden')
        .eq('proyecto_id', proyecto_id)
        .order('orden', { ascending: false })
        .limit(1)
        .single()

      const nextOrden = ((maxOrden?.orden as number) ?? 0) + 1

      const { error: ppError } = await admin
        .from('proyecto_partidas')
        .insert({
          proyecto_id,
          partida_id: partida.id,
          cantidad: 1,
          orden: nextOrden,
        })

      if (!ppError) addedToProject = true
    }

    return NextResponse.json({
      partida,
      addedToProject,
      message: addedToProject
        ? `Partida "${nombre}" creada y agregada al proyecto`
        : `Partida "${nombre}" creada en el catálogo`,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/partidas error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
