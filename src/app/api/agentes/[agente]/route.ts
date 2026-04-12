import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AGENTS_REGISTRY } from '@/lib/anthropic/agents'
import type { AgentMessage } from '@/lib/anthropic/agents'
import { agenteRequestSchema } from '@/lib/schemas'
import { streamLLM, getDefaultModel, decryptApiKey } from '@/lib/llm'
import type { LLMProvider } from '@/lib/llm'

interface DbKey {
  api_key_encrypted: string
  iv: string
}

const ENV_KEY_MAP: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GOOGLE_AI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  huggingface: 'HUGGINGFACE_API_KEY',
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agente: string }> }
) {
  try {
    const { agente } = await params

    // Validate agent slug
    const agentConfig = AGENTS_REGISTRY[agente as keyof typeof AGENTS_REGISTRY]
    if (!agentConfig) {
      return Response.json(
        { error: 'Agente "' + agente + '" no encontrado. Disponibles: ' + Object.keys(AGENTS_REGISTRY).join(', ') },
        { status: 404 }
      )
    }

    // Authenticate user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Parse and validate body
    const body = await request.json()
    const validated = agenteRequestSchema.parse(body)
    const systemPrompt = agentConfig.buildPrompt(validated.contexto)

    // Build messages array
    const messages: { role: 'user' | 'assistant'; content: string }[] = []
    if (validated.historial) {
      validated.historial.forEach((msg: AgentMessage) => {
        messages.push({ role: msg.role, content: msg.content })
      })
    }
    messages.push({ role: 'user', content: validated.mensaje })

    // Use per-agent defaults, then request overrides, then global fallback
    const provider = (validated.provider || agentConfig.defaultProvider || 'openrouter') as LLMProvider
    const model = validated.model || agentConfig.defaultModel || getDefaultModel(provider)

    // Resolve API key: user key -> org key -> env var
    let apiKey = ''

    // 1. User's own key
    const { data: userKey } = await supabase
      .from('llm_api_keys')
      .select('api_key_encrypted, iv')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('activo', true)
      .is('org_id', null)
      .single()

    const userKeyRow = userKey as unknown as DbKey | null
    if (userKeyRow) {
      try { apiKey = decryptApiKey(userKeyRow.api_key_encrypted, userKeyRow.iv) } catch { /* skip */ }
    }

    // 2. Org shared key
    if (!apiKey) {
      const { data: orgKey } = await supabase
        .from('llm_api_keys')
        .select('api_key_encrypted, iv')
        .eq('provider', provider)
        .eq('activo', true)
        .not('org_id', 'is', null)
        .limit(1)
        .single()

      const orgKeyRow = orgKey as unknown as DbKey | null
      if (orgKeyRow) {
        try { apiKey = decryptApiKey(orgKeyRow.api_key_encrypted, orgKeyRow.iv) } catch { /* skip */ }
      }
    }

    // 3. Env var fallback
    if (!apiKey) {
      apiKey = process.env[ENV_KEY_MAP[provider] || ''] || ''
    }

    if (!apiKey) {
      return Response.json(
        { error: 'No hay API key para ' + provider + '. Ve a Configuracion para agregar una.' },
        { status: 400 }
      )
    }

    // SSE delimiters
    const SSE_TAIL = '\n\n'
    const SSE_DONE = 'data: [DONE]' + SSE_TAIL

    // Stream response
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const stream = streamLLM(
            { provider, model, apiKey },
            { system: systemPrompt, messages, maxTokens: 4096 }
          )
          for await (const text of stream) {
            controller.enqueue(encoder.encode('data: ' + JSON.stringify({ text }) + SSE_TAIL))
          }
          controller.enqueue(encoder.encode(SSE_DONE))
          controller.close()
        } catch (err) {
          console.error('[' + agente + '] Streaming error:', err)
          const errorMsg = err instanceof Error ? err.message : 'Error de streaming'
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ error: errorMsg }) + SSE_TAIL))
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: unknown) {
    console.error('Agent route error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error del agente' },
      { status: 400 }
    )
  }
}
