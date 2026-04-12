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

const addMemberSchema = z.object({
  email: z.string().email('Email invalido'),
  rol: z.enum(['admin', 'miembro', 'viewer']).default('miembro'),
})

const updateRoleSchema = z.object({
  member_id: z.string().uuid(),
  rol: z.enum(['admin', 'miembro', 'viewer']),
})

// Helper: get user's org as admin
async function getUserOrgAsAdmin(userId: string) {
  const admin = getAdmin()
  const { data } = await admin
    .from('org_miembros')
    .select('org_id, rol')
    .eq('user_id', userId)
    .eq('rol', 'admin')
    .limit(1)
    .single()
  return data
}

// POST /api/organizacion/miembros — invite member by email
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const membership = await getUserOrgAsAdmin(user.id)
    if (!membership) {
      return Response.json({ error: 'Solo administradores pueden agregar miembros' }, { status: 403 })
    }

    const admin = getAdmin()
    const body = await request.json()
    const validated = addMemberSchema.parse(body)

    // Find user by email
    const { data: users } = await admin.auth.admin.listUsers()
    const targetUser = users?.users?.find(u => u.email === validated.email)

    if (!targetUser) {
      return Response.json(
        { error: 'Usuario no encontrado. Debe registrarse primero en la plataforma.' },
        { status: 404 }
      )
    }

    // Check not already a member
    const { data: existing } = await admin
      .from('org_miembros')
      .select('id')
      .eq('org_id', membership.org_id)
      .eq('user_id', targetUser.id)
      .limit(1)
      .single()

    if (existing) {
      return Response.json({ error: 'Este usuario ya es miembro de la organizacion' }, { status: 400 })
    }

    // Add member
    const { error } = await admin
      .from('org_miembros')
      .insert({
        org_id: membership.org_id,
        user_id: targetUser.id,
        rol: validated.rol,
      })

    if (error) throw error

    return Response.json({ ok: true, email: validated.email, rol: validated.rol }, { status: 201 })
  } catch (error: unknown) {
    console.error('POST /api/organizacion/miembros error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error al agregar miembro' },
      { status: 400 }
    )
  }
}

// PUT /api/organizacion/miembros — change member role
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const membership = await getUserOrgAsAdmin(user.id)
    if (!membership) {
      return Response.json({ error: 'Solo administradores pueden cambiar roles' }, { status: 403 })
    }

    const admin = getAdmin()
    const body = await request.json()
    const validated = updateRoleSchema.parse(body)

    const { error } = await admin
      .from('org_miembros')
      .update({ rol: validated.rol })
      .eq('id', validated.member_id)
      .eq('org_id', membership.org_id)

    if (error) throw error

    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error('PUT /api/organizacion/miembros error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error al cambiar rol' },
      { status: 400 }
    )
  }
}

// DELETE /api/organizacion/miembros?id=xxx — remove member
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const membership = await getUserOrgAsAdmin(user.id)
    if (!membership) {
      return Response.json({ error: 'Solo administradores pueden remover miembros' }, { status: 403 })
    }

    const admin = getAdmin()
    const memberId = new URL(request.url).searchParams.get('id')
    if (!memberId) {
      return Response.json({ error: 'id requerido' }, { status: 400 })
    }

    // Prevent removing yourself
    const { data: target } = await admin
      .from('org_miembros')
      .select('user_id')
      .eq('id', memberId)
      .single()

    if (target?.user_id === user.id) {
      return Response.json({ error: 'No puedes removerte a ti mismo' }, { status: 400 })
    }

    const { error } = await admin
      .from('org_miembros')
      .delete()
      .eq('id', memberId)
      .eq('org_id', membership.org_id)

    if (error) throw error

    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error('DELETE /api/organizacion/miembros error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error al remover miembro' },
      { status: 400 }
    )
  }
}
