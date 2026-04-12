import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bimImportSchema } from '@/lib/schemas'
import type { Tables } from '@/types/database'

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
    // Cast needed: Supabase RLS type inference resolves insert to 'never' for tables with policies
    const { data: rawImportData, error: importError } = await supabase
      .from('bim_importaciones')
      .insert({
        proyecto_id: validatedData.proyecto_id,
        archivo_nombre: 'imported_from_revit',
        total_elementos: validatedData.elementos.length,
        elementos_mapeados: 0,
        estado: 'procesando',
        importado_por: user.id,
      } as never)
      .select()
      .single()

    if (importError) throw importError

    const importData = rawImportData as unknown as Tables<'bim_importaciones'>

    // Create BIM elements
    const elementos = validatedData.elementos.map((el) => ({
      importacion_id: importData.id,
      revit_id: el.revit_id || null,
      familia: el.familia,
      tipo: el.tipo,
      parametros: {
        area: el.area || null,
        volumen: el.volumen || null,
        longitud: el.longitud || null,
        cantidad: el.cantidad || null,
        ...(el.parametros || {}),
      },
      estado: 'pendiente',
    }))

    const { error: elementosError } = await supabase
      .from('bim_elementos')
      .insert(elementos as never[])

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
        error: error instanceof Error ? error.message : 'Error procesando importaci\u00f3n',
      },
      { status: 400 }
    )
  }
}
