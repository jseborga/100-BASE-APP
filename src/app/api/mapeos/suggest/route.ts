import { createClient as createServerClient } from '@/lib/supabase/server'
import { getAnthropicClient } from '@/lib/anthropic/client'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/mapeos/suggest — AI generates instrucciones_computo for a mapping rule
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { categoria, partida, formula, parametro_principal, sample_params } = body

    if (!categoria || !partida || !formula) {
      return NextResponse.json({ error: 'categoria, partida y formula son requeridos' }, { status: 400 })
    }

    const anthropic = getAnthropicClient()

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Genera instrucciones de cómputo para esta regla de mapeo BIM. Las instrucciones deben ser claras, concisas y útiles para un modelador de Revit que necesita entender cómo se calcula el metrado.

Categoría Revit: ${categoria}
Partida de construcción: ${partida}
Fórmula: ${formula}
${parametro_principal ? `Parámetro principal: ${parametro_principal}` : ''}
${sample_params ? `Parámetros de ejemplo del modelo: ${JSON.stringify(sample_params)}` : ''}

Escribe las instrucciones en español, en 2-4 líneas. Incluye:
1. Qué se mide exactamente
2. Qué parámetros del modelo se usan y por qué
3. Si hay factor de desperdicio, explicar por qué
4. Cualquier consideración especial para el modelador

Solo devuelve las instrucciones, sin encabezados ni formato markdown.`
        }
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({ suggestion: text.trim() })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error generando sugerencia' },
      { status: 500 }
    )
  }
}
