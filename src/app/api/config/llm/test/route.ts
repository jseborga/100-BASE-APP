import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptApiKey } from '@/lib/llm'
import { PROVIDERS } from '@/lib/llm'
import type { LLMProvider } from '@/lib/llm'
import { z } from 'zod'

const testSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
})

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

// POST /api/config/llm/test — test connection to a provider/model
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validated = testSchema.parse(body)
    const provider = validated.provider as LLMProvider
    const model = validated.model

    // Resolve API key (same logic as agent route)
    let apiKey = ''

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

    if (!apiKey) {
      apiKey = process.env[ENV_KEY_MAP[provider] || ''] || ''
    }

    if (!apiKey) {
      return Response.json({
        ok: false,
        error: `No hay API key para ${provider}. Agrega una en la tab "API Keys".`,
      })
    }

    // Send a minimal test request
    const startTime = Date.now()

    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Responde solo "ok"' }],
        }),
      })

      const elapsed = Date.now() - startTime

      if (!res.ok) {
        const err = await res.text()
        let parsed: { error?: { message?: string } } = {}
        try { parsed = JSON.parse(err) } catch { /* skip */ }
        return Response.json({
          ok: false,
          error: parsed.error?.message || `HTTP ${res.status}: ${err.slice(0, 200)}`,
          latency: elapsed,
        })
      }

      return Response.json({ ok: true, latency: elapsed, provider, model })
    } else {
      // OpenAI-compatible (OpenAI, Gemini, OpenRouter, HuggingFace)
      const providerConfig = PROVIDERS[provider]
      const baseURL = providerConfig?.baseURL || 'https://api.openai.com/v1'
      const endpoint = `${baseURL.replace(/\/$/, '')}/chat/completions`

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }

      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'https://constructionos.app'
        headers['X-Title'] = 'ConstructionOS'
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [
            { role: 'system', content: 'Responde solo ok' },
            { role: 'user', content: 'test' },
          ],
        }),
      })

      const elapsed = Date.now() - startTime

      if (!res.ok) {
        const err = await res.text()
        let parsed: { error?: { message?: string } } = {}
        try { parsed = JSON.parse(err) } catch { /* skip */ }
        return Response.json({
          ok: false,
          error: parsed.error?.message || `HTTP ${res.status}: ${err.slice(0, 200)}`,
          latency: elapsed,
        })
      }

      return Response.json({ ok: true, latency: elapsed, provider, model })
    }
  } catch (error: unknown) {
    console.error('LLM test error:', error)
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Error de conexion',
    })
  }
}
