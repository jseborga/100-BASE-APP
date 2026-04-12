import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PROVIDERS, MODELS } from '@/lib/llm'

// GET /api/config/llm — returns available providers and models
// Only returns providers that have API keys configured
export async function GET(_request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build list of available providers (those with API keys set)
    const available = Object.values(PROVIDERS)
      .filter(p => !!process.env[p.envKey])
      .map(p => ({
        id: p.id,
        name: p.name,
        models: MODELS.filter(m => m.provider === p.id).map(m => ({
          id: m.id,
          name: m.name,
          contextWindow: m.contextWindow,
        })),
      }))

    return new Response(JSON.stringify({ providers: available }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('LLM config error:', error)
    return new Response(
      JSON.stringify({ error: 'Error loading LLM config' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
