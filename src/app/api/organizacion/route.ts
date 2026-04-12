import { NextRequest } from 'next/server'
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

const createOrgSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Solo minusculas, numeros y guiones').optional(),
})

const updateOrgSchema = z.object({
  nombre: z.string().min(1).optional(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional(),
})

// GET /api/organizacion — returns user's organization with members
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = getAdmin()

    // Find user's org membership
    const { data: membership } = await admin
      .from('org_miembros')
      .select('org_id, rol')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      return Response.json({ org: null, members: [], userRole: null })
    }

    // Get org details
    const { data: org } = await admin
      .from('organizaciones')
      .select('*')
      .eq('id', membership.org_id)
      .single()

    // Get all members with emails from auth.users
    const { data: members } = await admin
      .from('org_miembros')
      .select('id, user_id, rol, created_at')
      .eq('org_id', membership.org_id)
      .order('created_at', { ascending: true })

    // Fetch emails for all members
    const memberList = []
    for (const m of (members || [])) {
      const { data: userData } = await admin.auth.admin.getUserById(m.user_id)
      memberList.push({
        id: m.id,
        user_id: m.user_id,
        email: userData?.user?.email || 'unknown',
        rol: m.rol,
        created_at: m.created_at,
        is_current: m.user_id === user.id,
      })
    }

    return Response.json({
      org,
      members: memberList,
      userRole: membership.rol,
    })
  } catch (error: unknown) {
    console.error('GET /api/organizacion error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    )
  }
}

// POST /api/organizacion — create organization (user becomes admin)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = getAdmin()

    // Check user doesn't already belong to an org
    const { data: existing } = await admin
      .from('org_miembros')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (existing) {
      return Response.json({ error: 'Ya perteneces a una organizacion' }, { status: 400 })
    }

    const body = await request.json()
    const validated = createOrgSchema.parse(body)

    // Create org
    const { data: org, error: orgError } = await admin
      .from('organizaciones')
      .insert({
        nombre: validated.nombre,
        slug: validated.slug || validated.nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      })
      .select()
      .single()

    if (orgError) throw orgError

    // Add user as admin
    const { error: memberError } = await admin
      .from('org_miembros')
      .insert({
        org_id: org.id,
        user_id: user.id,
        rol: 'admin',
      })

    if (memberError) throw memberError

    return Response.json({ org }, { status: 201 })
  } catch (error: unknown) {
    console.error('POST /api/organizacion error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error al crear' },
      { status: 400 }
    )
  }
}

// PUT /api/organizacion — update organization (admin only)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = getAdmin()

    // Verify admin role
    const { data: membership } = await admin
      .from('org_miembros')
      .select('org_id, rol')
      .eq('user_id', user.id)
      .eq('rol', 'admin')
      .limit(1)
      .single()

    if (!membership) {
      return Response.json({ error: 'Solo administradores pueden editar la organizacion' }, { status: 403 })
    }

    const body = await request.json()
    const validated = updateOrgSchema.parse(body)

    const { data: org, error } = await admin
      .from('organizaciones')
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq('id', membership.org_id)
      .select()
      .single()

    if (error) throw error

    return Response.json({ org })
  } catch (error: unknown) {
    console.error('PUT /api/organizacion error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar' },
      { status: 400 }
    )
  }
}
