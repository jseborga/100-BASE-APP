import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptApiKey } from '@/lib/llm'
import { z } from 'zod'

const addKeySchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'gemini', 'openrouter', 'huggingface']),
  api_key: z.string().min(5, 'API key demasiado corta'),
  label: z.string().optional(),
})

// POST /api/config/llm/keys — add or update an API key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validated = addKeySchema.parse(body)

    // Encrypt the API key
    const { encrypted, iv } = encryptApiKey(validated.api_key)

    // Upsert: one key per provider per user (atomic, avoids RLS race condition)
    const { error } = await supabase
      .from('llm_api_keys')
      .upsert({
        user_id: user.id,
        provider: validated.provider,
        api_key_encrypted: encrypted,
        iv,
        label: validated.label || null,
        activo: true,
      } as never, { onConflict: 'user_id,provider' })

    if (error) throw error

    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error('Add key error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error al guardar la key' },
      { status: 400 }
    )
  }
}

// DELETE /api/config/llm/keys?id=xxx — remove an API key
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('id')
    const provider = searchParams.get('provider')

    if (keyId) {
      const { error } = await supabase
        .from('llm_api_keys')
        .delete()
        .eq('id', keyId)
        .eq('user_id', user.id)

      if (error) throw error
    } else if (provider) {
      const { error } = await supabase
        .from('llm_api_keys')
        .delete()
        .eq('provider', provider)
        .eq('user_id', user.id)

      if (error) throw error
    } else {
      return Response.json({ error: 'id or provider required' }, { status: 400 })
    }

    return Response.json({ ok: true })
  } catch (error: unknown) {
    console.error('Delete key error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar la key' },
      { status: 400 }
    )
  }
}
