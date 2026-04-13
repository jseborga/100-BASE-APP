import { NextRequest, NextResponse } from 'next/server'
import { getAdmin } from '@/lib/webhooks/auth'
import { bimImportSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = bimImportSchema.parse(body)

    const admin = getAdmin()

    // Resolve category names → IDs
    const { data: categorias } = await admin
      .from('revit_categorias')
      .select('id, nombre, nombre_es')

    const catMap = new Map<string, string>()
    for (const c of categorias || []) {
      catMap.set(c.nombre, c.id)
      if (c.nombre_es) catMap.set(c.nombre_es, c.id)
    }

    // Create BIM import record
    const { data: importData, error: importError } = await admin
      .from('bim_importaciones')
      .insert({
        proyecto_id: validatedData.proyecto_id,
        archivo_nombre: validatedData.archivo_nombre || 'Revit Export',
        total_elementos: validatedData.elementos.length,
        elementos_mapeados: 0,
        estado: 'pendiente',
      })
      .select()
      .single()

    if (importError) throw importError

    // Build element rows with JSONB parametros (numeric + metadata + notas)
    const elementos = validatedData.elementos.map((el) => {
      const allParams: Record<string, unknown> = { ...(el.parametros || {}) }
      if (el.metadata && Object.keys(el.metadata).length > 0) {
        allParams._metadata = el.metadata
      }
      if (el.unique_id) {
        allParams._unique_id = el.unique_id
      }
      if (el.notas_ia && Object.keys(el.notas_ia).length > 0) {
        allParams._notas_ia = el.notas_ia
      }
      if (el.nota_familia) {
        allParams._nota_familia = el.nota_familia
      }

      return {
        importacion_id: importData.id,
        revit_id: el.revit_id || null,
        revit_categoria_id: (el.categoria && catMap.get(el.categoria)) || null,
        familia: el.familia,
        tipo: el.tipo,
        parametros: allParams,
        estado: 'pendiente',
      }
    })

    const { error: elementosError } = await admin
      .from('bim_elementos')
      .insert(elementos)

    if (elementosError) throw elementosError

    return NextResponse.json(
      {
        success: true,
        importacion_id: importData.id,
        elementos_importados: validatedData.elementos.length,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('BIM import error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error procesando importación',
      },
      { status: 400 }
    )
  }
}
