import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bimImportSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = bimImportSchema.parse(body)

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Create BIM import record
    const { data: importData, error: importError } = await supabase
      .from('bim_importaciones')
      .insert({
        projeto_id: validatedData.proyecto_id,
        arquivo_nome: 'imported_from_revit',
        elementos_importados: validatedData.elementos.length,
        estado: 'procesando',
        usuario_id: user.id,
      })
      .select()
      .single()

    if (importError) throw importError

    // Create BIM elements
    const elementos = validatedData.elementos.map((el) => ({
      importacion_id: importData.id,
      categoria_revit: el.categoria_revit,
      familia: el.familia,
      tipo: el.tipo,
      area: el.area || null,
      volumen: el.volumen || null,
      longitud: el.longitud || null,
      cantidad: el.cantidad || null,
      parametros: el.parametros || null,
      partida_id: null,
    }))

    const { error: elementosError } = await supabase
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
  } catch (error) {
    console.error('BIM import error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error procesando importación',
      },
      { status: 400 }
    )
  }
}
