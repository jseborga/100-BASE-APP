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

// GET /api/config/llm/provider-models?provider=openrouter
// Returns available models for a provider (or all if no filter)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = getAdmin()
    const provider = request.nextUrl.searchParams.get('provider')

    let query = admin
      .from('provider_models')
      .select('id, provider, model_id, model_name, context_window, activo, orden')
      .eq('activo', true)
      .order('provider')
      .order('orden', { ascending: true })

    if (provider) {
      query = query.eq('provider', provider)
    }

    const { data, error } = await query

    if (error) {
      console.error('Provider models query error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ models: data || [] })
  } catch (error: unknown) {
    console.error('Provider models GET error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    )
  }
}

const addModelSchema = z.object({
  provider: z.string().min(1),
  model_id: z.string().min(1),
  model_name: z.string().min(1),
  context_window: z.number().int().min(0).default(0),
})

// POST /api/config/llm/provider-models — add a model to a provider
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validated = addModelSchema.parse(body)

    const admin = getAdmin()

    // Get max orden for this provider
    const { data: maxRow } = await admin
      .from('provider_models')
      .select('orden')
      .eq('provider', validated.provider)
      .order('orden', { ascending: false })
      .limit(1)
      .single()

    const nextOrden = (maxRow?.orden ?? 0) + 1

    const { error } = await admin
      .from('provider_models')
      .upsert({
        provider: validated.provider,
        model_id: validated.model_id,
        model_name: validated.model_name,
        context_window: validated.context_window,
        activo: true,
        orden: nextOrden,
      }, { onConflict: 'provider,model_id' })

    if (error) {
      console.error('Add model error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error('Provider models POST error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error al agregar modelo' },
      { status: 400 }
    )
  }
}

// DELETE /api/config/llm/provider-models?id=xxx — remove a model
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return Response.json({ error: 'id requerido' }, { status: 400 })
    }

    const admin = getAdmin()
    const { error } = await admin
      .from('provider_models')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete model error:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error('Provider models DELETE error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 400 }
    )
  }
}
