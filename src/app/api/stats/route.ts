import { NextResponse } from 'next/server'
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

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = getAdmin()

    // Get user's org memberships
    const { data: orgRows } = await admin
      .from('org_miembros')
      .select('org_id')
      .eq('user_id', user.id)

    const orgIds = (orgRows ?? []).map((r: { org_id: string }) => r.org_id)

    // User's projects
    let proyectosQuery = admin
      .from('proyectos')
      .select('id, nombre, estado, pais_id, propietario_id, org_id, created_at, paises(codigo, nombre)')

    if (orgIds.length > 0) {
      proyectosQuery = proyectosQuery.or(`propietario_id.eq.${user.id},org_id.in.(${orgIds.join(',')})`)
    } else {
      proyectosQuery = proyectosQuery.eq('propietario_id', user.id)
    }

    const { data: proyectos } = await proyectosQuery

    const userProjects = proyectos ?? []
    const projectIds = userProjects.map((p: { id: string }) => p.id)

    // Count partidas assigned to user's projects
    let totalPartidasAsignadas = 0
    let totalMetrado = 0
    if (projectIds.length > 0) {
      const { data: ppRows } = await admin
        .from('proyecto_partidas')
        .select('id, metrado_final, metrado_manual, metrado_bim')
        .in('proyecto_id', projectIds)

      totalPartidasAsignadas = (ppRows ?? []).length
      totalMetrado = (ppRows ?? []).reduce((sum: number, r: { metrado_final: number | null; metrado_manual: number | null; metrado_bim: number | null }) => {
        return sum + Number(r.metrado_final ?? r.metrado_manual ?? r.metrado_bim ?? 0)
      }, 0)
    }

    // Global catalog stats
    const [catalogoRes, paisesRes, estandaresRes, bimRes] = await Promise.all([
      admin.from('partidas').select('*', { count: 'exact', head: true }),
      admin.from('paises').select('*', { count: 'exact', head: true }),
      admin.from('estandares').select('*', { count: 'exact', head: true }),
      projectIds.length > 0
        ? admin.from('bim_importaciones').select('*', { count: 'exact', head: true }).in('proyecto_id', projectIds)
        : Promise.resolve({ count: 0 }),
    ])

    // Projects by estado
    const estadoCounts: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userProjects.forEach((p: any) => {
      const e = p.estado || 'activo'
      estadoCounts[e] = (estadoCounts[e] || 0) + 1
    })

    // Projects by country
    const paisCounts: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userProjects.forEach((p: any) => {
      const pais = p.paises
      const nombre = Array.isArray(pais) ? pais[0]?.nombre : pais?.nombre
      if (nombre) paisCounts[nombre] = (paisCounts[nombre] || 0) + 1
    })

    // Recent projects (last 5)
    const recientes = userProjects
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => {
        const pais = p.paises
        return {
          id: p.id,
          nombre: p.nombre,
          estado: p.estado,
          pais: Array.isArray(pais) ? pais[0]?.nombre : pais?.nombre,
          created_at: p.created_at,
        }
      })

    return NextResponse.json({
      proyectos: {
        total: userProjects.length,
        por_estado: estadoCounts,
        por_pais: paisCounts,
      },
      catalogo: {
        total_partidas: catalogoRes.count || 0,
        total_paises: paisesRes.count || 0,
        total_estandares: estandaresRes.count || 0,
      },
      asignaciones: {
        partidas_asignadas: totalPartidasAsignadas,
        metrado_total: Math.round(totalMetrado * 100) / 100,
      },
      bim: {
        importaciones: bimRes.count || 0,
      },
      recientes,
    })
  } catch (error) {
    console.error('GET /api/stats error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
