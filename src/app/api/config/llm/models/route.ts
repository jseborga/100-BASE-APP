import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptApiKey } from '@/lib/llm'

interface DbKey {
  api_key_encrypted: string
  iv: string
}

interface OpenRouterModel {
  id: string
  name: string
  context_length: number
  pricing?: { prompt: string; completion: string }
  architecture?: { modality: string }
}

// GET /api/config/llm/models?provider=openrouter
// Fetches dynamic model list from provider API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const provider = request.nextUrl.searchParams.get('provider')
    if (provider !== 'openrouter') {
      return Response.json({ error: 'Dynamic models only supported for openrouter' }, { status: 400 })
    }

    // Get user's OpenRouter key
    const { data: keyData } = await supabase
      .from('llm_api_keys')
      .select('api_key_encrypted, iv')
      .eq('user_id', user.id)
      .eq('provider', 'openrouter')
      .eq('activo', true)
      .single()

    const keyRow = keyData as unknown as DbKey | null

    // Fallback to env var
    let apiKey = process.env.OPENROUTER_API_KEY || ''
    if (keyRow) {
      try {
        apiKey = decryptApiKey(keyRow.api_key_encrypted, keyRow.iv)
      } catch {
        // fallback to env var
      }
    }

    if (!apiKey) {
      return Response.json({ error: 'No OpenRouter API key configured' }, { status: 400 })
    }

    // Fetch models from OpenRouter
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://constructionos.app',
      },
      next: { revalidate: 3600 }, // Cache 1 hour
    })

    if (!res.ok) {
      throw new Error(`OpenRouter API error: ${res.status}`)
    }

    const data = await res.json()
    const models = (data.data || []) as OpenRouterModel[]

    // Filter to text models and format
    const formatted = models
      .filter((m: OpenRouterModel) => {
        const modality = m.architecture?.modality || ''
        return modality.includes('text')
      })
      .map((m: OpenRouterModel) => ({
        id: m.id,
        name: m.name,
        contextWindow: m.context_length || 4096,
        pricing: m.pricing ? {
          prompt: m.pricing.prompt,
          completion: m.pricing.completion,
        } : undefined,
      }))
      .slice(0, 200) // Limit to 200 models

    return Response.json({ models: formatted })
  } catch (error: unknown) {
    console.error('Fetch models error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error fetching models' },
      { status: 500 }
    )
  }
}
