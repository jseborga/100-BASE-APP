import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AGENTS_REGISTRY } from '@/lib/anthropic/agents'
import { z } from 'zod'

const validSlugs = Object.keys(AGENTS_REGISTRY) as [string, ...string[]]

const upsertSchema = z.object({
  agent_slug: z.enum(validSlugs),
  provider: z.string().min(1),
  model: z.string().min(1),
})

// GET /api/config/agentes — returns user's agent LLM config
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data } = await supabase
      .from('agent_config')
      .select('agent_slug, provider, model')
      .eq('user_id', user.id)

    // Build config map: { orquestador: { provider, model }, ... }
    const config: Record<string, { provider: string; model: string }> = {}
    for (const row of (data || []) as { agent_slug: string; provider: string; model: string }[]) {
      config[row.agent_slug] = { provider: row.provider, model: row.model }
    }

    // Merge with defaults from registry
    const result: Record<string, { provider: string; model: string; isCustom: boolean }> = {}
    for (const [slug, agent] of Object.entries(AGENTS_REGISTRY)) {
      if (config[slug]) {
        result[slug] = { ...config[slug], isCustom: true }
      } else {
        result[slug] = {
          provider: agent.defaultProvider,
          model: agent.defaultModel,
          isCustom: false,
        }
      }
    }

    return Response.json({ config: result })
  } catch (error: unknown) {
    console.error('Agent config GET error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 }
    )
  }
}

// POST /api/config/agentes — upsert agent config
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validated = upsertSchema.parse(body)

    const { error } = await supabase
      .from('agent_config')
      .upsert({
        user_id: user.id,
        agent_slug: validated.agent_slug,
        provider: validated.provider,
        model: validated.model,
      } as never, { onConflict: 'user_id,agent_slug' })

    if (error) throw error

    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error('Agent config POST error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error al guardar' },
      { status: 400 }
    )
  }
}

// DELETE /api/config/agentes?slug=normativa — reset to default
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const slug = new URL(request.url).searchParams.get('slug')
    if (!slug) {
      return Response.json({ error: 'slug requerido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('agent_config')
      .delete()
      .eq('user_id', user.id)
      .eq('agent_slug', slug)

    if (error) throw error

    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error('Agent config DELETE error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 400 }
    )
  }
}
