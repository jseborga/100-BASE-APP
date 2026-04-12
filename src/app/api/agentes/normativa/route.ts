import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildNormativaSystemPrompt } from '@/lib/anthropic/agents'
import type { AgentMessage } from '@/lib/anthropic/agents'
import { agenteRequestSchema } from '@/lib/schemas'
import { streamLLM } from '@/lib/llm'
import type { LLMProvider } from '@/lib/llm'

export async function POST(request: NextRequest) {
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

    // Validate request
    const body = await request.json()
    const validated = agenteRequestSchema.parse(body)

    // Build system prompt with project context
    const systemPrompt = buildNormativaSystemPrompt(validated.contexto)

    // Build messages array from history + new message
    const messages: { role: 'user' | 'assistant'; content: string }[] = []

    if (validated.historial) {
      validated.historial.forEach((msg: AgentMessage) => {
        messages.push({ role: msg.role, content: msg.content })
      })
    }

    messages.push({ role: 'user', content: validated.mensaje })

    // Determine provider and model from request or defaults
    const provider = (validated.provider || 'openai') as LLMProvider
    const model = validated.model || getDefaultModelForProvider(provider)

    // Stream response from LLM
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const stream = streamLLM(
            { provider, model },
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
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Error del agente de normativa',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

function getDefaultModelForProvider(provider: LLMProvider): string {
  const defaults: Record<LLMProvider, string> = {
    anthropic: 'claude-sonnet-4-20250514',
    openai: 'gpt-4o',
    gemini: 'gemini-2.0-flash',
    openrouter: 'meta-llama/llama-3.1-70b-instruct',
  }
  return defaults[provider]
}
