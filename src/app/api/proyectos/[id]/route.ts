import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

// GET /api/proyectos/[id] — single project with partidas
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const adminClient = getAdminClient()

    // Fetch project with country
    const { data: proyecto, error: projError } = await adminClient
      .from('proyectos')
      .select('*, paises(id, codigo, nombre)')
      .eq('id', id)
      .single()

    if (projError || !proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Verify user has access (owner, org member, or project member)
    const isOwner = proyecto.propietario_id === user.id

    let isMember = false
    if (!isOwner) {
      const { data: membership } = await adminClient
        .from('proyecto_miembros')
        .select('id')
        .eq('proyecto_id', id)
        .eq('usuario_id', user.id)
        .limit(1)
        .single()
      isMember = !!membership
    }

    let isOrgMember = false
    if (!isOwner && !isMember && proyecto.org_id) {
      const { data: orgMembership } = await adminClient
        .from('org_miembros')
        .select('id')
        .eq('org_id', proyecto.org_id)
        .eq('user_id', user.id)
        .limit(1)
        .single()
      isOrgMember = !!orgMembership
    }

    if (!isOwner && !isMember && !isOrgMember) {
      return NextResponse.json({ error: 'No tienes acceso a este proyecto' }, { status: 403 })
    }

    // Fetch project partidas with partida info
    const { data: partidas } = await adminClient
      .from('proyecto_partidas')
      .select('*, partidas(id, nombre, unidad, capitulo)')
      .eq('proyecto_id', id)
      .order('orden', { ascending: true })

    return NextResponse.json({
      ...proyecto,
      partidas: partidas || [],
    })
  } catch (error) {
    console.error('GET /api/proyectos/[id] error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
