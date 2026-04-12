import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildNormativaSystemPrompt } from '@/lib/anthropic/agents'
import type { AgentMessage } from '@/lib/anthropic/agents'
import { agenteRequestSchema } from '@/lib/schemas'
import { streamLLM, getDefaultModel, decryptApiKey } from '@/lib/llm'
import type { LLMProvider } from '@/lib/llm'

interface DbKey {
  api_key_encrypted: string
  iv: string
}

// Env var fallback map
const ENV_KEY_MAP: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GOOGLE_AI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  huggingface: 'HUGGINGFACE_API_KEY',
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Validate request
    const body = await request.json()
    const validated = agenteRequestSchema.parse(body)

    // Build system prompt with project context
    const systemPrompt = buildNormativaSystemPrompt(validated.contexto)

    // Build messages array
    const messages: { role: 'user' | 'assistant'; content: string }[] = []
    if (validated.historial) {
      validated.historial.forEach((msg: AgentMessage) => {
        messages.push({ role: msg.role, content: msg.content })
      })
    }
    messages.push({ role: 'user', content: validated.mensaje })

    // Determine provider and model
    const provider = (validated.provider || 'openai') as LLMProvider
    const model = validated.model || getDefaultModel(provider)

    // Get API key: try user's DB key first, then env var fallback
    let apiKey = ''

    const { data: keyData } = await supabase
      .from('llm_api_keys')
      .select('api_key_encrypted, iv')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('activo', true)
      .single()

    const keyRow = keyData as unknown as DbKey | null

    if (keyRow) {
      try {
        apiKey = decryptApiKey(keyRow.api_key_encrypted, keyRow.iv)
      } catch (err) {
        console.error('Key decryption failed:', err)
      }
    }

    // Fallback to env var
    if (!apiKey) {
      apiKey = process.env[ENV_KEY_MAP[provider] || ''] || ''
    }

    if (!apiKey) {
      return Response.json(
        { error: `No hay API key configurada para ${provider}. Ve a Configuraci\u00f3n para agregar una.` },
        { status: 400 }
      )
    }

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
            const chunk = `data: ${JSON.stringify({ text })}\n\n`
            controller.enqueue(encoder.encode(chunk))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          console.error('Streaming error:', err)
          const errorMsg = err instanceof Error ? err.message : 'Error de streaming'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
          )
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
    console.error('Normativa agent error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error del agente de normativa' },
      { status: 400 }
    )
  }
}
