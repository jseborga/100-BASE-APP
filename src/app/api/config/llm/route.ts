import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PROVIDERS, STATIC_MODELS } from '@/lib/llm'
import { decryptApiKey, maskApiKey } from '@/lib/llm'
import type { LLMProvider } from '@/lib/llm'

interface DbKey {
  id: string
  provider: string
  api_key_encrypted: string
  iv: string
  label: string | null
  activo: boolean
}

// GET /api/config/llm — returns user's configured providers with models
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Read user's API keys from DB
    const { data: keysData } = await supabase
      .from('llm_api_keys')
      .select('id, provider, api_key_encrypted, iv, label, activo')
      .eq('user_id', user.id)
      .eq('activo', true)

    const keys = (keysData ?? []) as unknown as DbKey[]

    // Build provider list from user's keys
    const available = keys.map(key => {
      const provider = key.provider as LLMProvider
      const config = PROVIDERS[provider]
      if (!config) return null

      // Mask the key for display
      let maskedKey = '****'
      try {
        const decrypted = decryptApiKey(key.api_key_encrypted, key.iv)
        maskedKey = maskApiKey(decrypted)
      } catch {
        // If decryption fails, show generic mask
      }

      return {
        id: provider,
        name: config.name,
        description: config.description,
        keyId: key.id,
        maskedKey,
        label: key.label,
        supportsModelFetch: config.supportsModelFetch,
        models: STATIC_MODELS
          .filter(m => m.provider === provider)
          .map(m => ({ id: m.id, name: m.name, contextWindow: m.contextWindow })),
      }
    }).filter(Boolean)

    // Also check env var fallbacks (for admin/global keys)
    const envProviders: string[] = []
    for (const [id, config] of Object.entries(PROVIDERS)) {
      const envKey = `${id.toUpperCase()}_API_KEY`
      const altEnvKey = id === 'gemini' ? 'GOOGLE_AI_API_KEY' : 
                        id === 'anthropic' ? 'ANTHROPIC_API_KEY' : envKey
      if (process.env[altEnvKey] && !keys.find(k => k.provider === id)) {
        envProviders.push(id)
        available.push({
          id: id as LLMProvider,
          name: config.name,
          description: config.description,
          keyId: null as unknown as string,
          maskedKey: '(env var)',
          label: 'Global',
          supportsModelFetch: config.supportsModelFetch,
          models: STATIC_MODELS
            .filter(m => m.provider === id)
            .map(m => ({ id: m.id, name: m.name, contextWindow: m.contextWindow })),
        })
      }
    }

    // Return all providers including the full list for the "add" UI
    const allProviders = Object.values(PROVIDERS).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
    }))

    return Response.json({ providers: available, allProviders })
  } catch (error: unknown) {
    console.error('LLM config error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error loading LLM config' },
      { status: 500 }
    )
  }
}
