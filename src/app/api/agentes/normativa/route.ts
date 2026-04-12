import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic/client'
import { buildNormativaSystemPrompt, AGENT_MODEL } from '@/lib/anthropic/agents'
import type { AgentMessage } from '@/lib/anthropic/agents'
import { agenteRequestSchema } from '@/lib/schemas'

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

    // Call Claude with streaming
    const anthropic = getAnthropicClient()

    const stream = anthropic.messages.stream({
      model: AGENT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    })

    // Return streaming response
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const chunk = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
              controller.enqueue(encoder.encode(chunk))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          console.error('Streaming error:', err)
          controller.error(err)
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
