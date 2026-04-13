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

// GET /api/mapeos/partidas?q=<search> — search partidas for the mapeo form
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || ''

    if (q.length < 2) {
      return NextResponse.json({ partidas: [] })
    }

    const admin = getAdminClient()
    const { data, error } = await admin
      .from('partidas')
      .select('id, nombre, unidad, capitulo')
      .ilike('nombre', `%${q}%`)
      .order('nombre')
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ partidas: data || [] })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}
