import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: SupabaseClient<any> | null = null
function getAdmin(): SupabaseClient<any> {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

interface PartidaRow {
  id: string
  orden: number | null
  metrado_manual: number | null
  metrado_bim: number | null
  metrado_final: number | null
  notas: string | null
  partidas: {
    id: string
    nombre: string
    unidad: string
    capitulo: string | null
    partida_localizaciones: {
      codigo_local: string
      referencia_norma: string | null
      estandar_id: string
    }[]
  } | null
}

// GET /api/proyectos/[id]/export?format=excel|json
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proyectoId } = await params
    const format = request.nextUrl.searchParams.get('format') || 'json'

    // Auth
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = getAdmin()

    // Fetch project
    const { data: proyecto, error: projError } = await admin
      .from('proyectos')
      .select('id, nombre, estado, tipologia, ubicacion, pais_id, propietario_id, org_id, paises(id, codigo, nombre)')
      .eq('id', proyectoId)
      .single()

    if (projError || !proyecto) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    // Verify access
    const isOwner = proyecto.propietario_id === user.id
    if (!isOwner) {
      const { data: membership } = await admin
        .from('proyecto_miembros')
        .select('id')
        .eq('proyecto_id', proyectoId)
        .eq('usuario_id', user.id)
        .limit(1)
        .single()

      if (!membership) {
        const { data: orgMembership } = await admin
          .from('org_miembros')
          .select('id')
          .eq('org_id', proyecto.org_id)
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (!orgMembership) {
          return NextResponse.json({ error: 'No tienes acceso' }, { status: 403 })
        }
      }
    }

    // Fetch project partidas with catalog info and localizations
    const { data: rows } = await admin
      .from('proyecto_partidas')
      .select('id, orden, metrado_manual, metrado_bim, metrado_final, notas, partidas(id, nombre, unidad, capitulo, partida_localizaciones(codigo_local, referencia_norma, estandar_id))')
      .eq('proyecto_id', proyectoId)
      .order('orden', { ascending: true })

    const partidas = (rows ?? []) as unknown as PartidaRow[]

    // Get the project's country standard for filtering localizations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paisObj = proyecto.paises as any
    const paisCodigo: string = Array.isArray(paisObj) ? paisObj[0]?.codigo || '' : paisObj?.codigo || ''
    const { data: estandar } = await admin
      .from('estandares')
      .select('id')
      .eq('pais_id', proyecto.pais_id)
      .limit(1)
      .single()

    const estandarId = estandar?.id || ''

    // Build export data
    const exportRows = partidas.map((pp, idx) => {
      const p = pp.partidas
      const loc = p?.partida_localizaciones?.find(l => l.estandar_id === estandarId)
      const metrado = pp.metrado_final ?? pp.metrado_manual ?? pp.metrado_bim ?? 0

      return {
        item: pp.orden ?? idx + 1,
        codigo: loc?.codigo_local || '',
        partida: p?.nombre || '',
        unidad: p?.unidad || '',
        metrado: Number(metrado),
        capitulo: p?.capitulo || '',
        referencia_norma: loc?.referencia_norma || '',
        notas: pp.notas || '',
        origen: pp.metrado_bim != null ? 'BIM' : pp.metrado_manual != null ? 'Manual' : '',
      }
    })

    // JSON export
    if (format === 'json') {
      const exportData = {
        proyecto: {
          nombre: proyecto.nombre,
          pais: paisCodigo,
          tipologia: proyecto.tipologia,
          ubicacion: proyecto.ubicacion,
          estado: proyecto.estado,
          total_partidas: exportRows.length,
          fecha_exportacion: new Date().toISOString(),
        },
        partidas: exportRows,
      }

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${sanitizeFilename(proyecto.nombre)}_planilla.json"`,
        },
      })
    }

    // Excel export
    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'ConstructionOS'
      workbook.created = new Date()

      const sheet = workbook.addWorksheet('Planilla de Metrados')

      // Title row
      sheet.mergeCells('A1:H1')
      const titleCell = sheet.getCell('A1')
      titleCell.value = `Planilla de Metrados — ${proyecto.nombre}`
      titleCell.font = { bold: true, size: 14 }
      titleCell.alignment = { horizontal: 'center' }

      // Info rows
      sheet.mergeCells('A2:H2')
      const paisNombre: string = Array.isArray(paisObj) ? paisObj[0]?.nombre || '' : paisObj?.nombre || ''
      sheet.getCell('A2').value = `País: ${paisNombre} | Tipología: ${proyecto.tipologia || '—'} | Ubicación: ${proyecto.ubicacion || '—'}`
      sheet.getCell('A2').font = { size: 10, color: { argb: '666666' } }
      sheet.getCell('A2').alignment = { horizontal: 'center' }

      sheet.mergeCells('A3:H3')
      sheet.getCell('A3').value = `Exportado: ${new Date().toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })} | Total partidas: ${exportRows.length}`
      sheet.getCell('A3').font = { size: 10, color: { argb: '666666' } }
      sheet.getCell('A3').alignment = { horizontal: 'center' }

      // Empty row
      sheet.addRow([])

      // Header row
      const headerRow = sheet.addRow(['Item', 'Código', 'Partida', 'Unidad', 'Metrado', 'Capítulo', 'Ref. Norma', 'Notas'])
      headerRow.font = { bold: true, size: 11 }
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } }
        cell.border = {
          bottom: { style: 'thin', color: { argb: '94A3B8' } },
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      })

      // Column widths
      sheet.getColumn(1).width = 6    // Item
      sheet.getColumn(2).width = 12   // Código
      sheet.getColumn(3).width = 45   // Partida
      sheet.getColumn(4).width = 8    // Unidad
      sheet.getColumn(5).width = 12   // Metrado
      sheet.getColumn(6).width = 30   // Capítulo
      sheet.getColumn(7).width = 35   // Ref. Norma
      sheet.getColumn(8).width = 25   // Notas

      // Data rows grouped by chapter
      let currentChapter = ''
      for (const row of exportRows) {
        if (row.capitulo !== currentChapter) {
          currentChapter = row.capitulo
          const chapterRow = sheet.addRow([])
          sheet.mergeCells(`A${chapterRow.number}:H${chapterRow.number}`)
          const chapterCell = sheet.getCell(`A${chapterRow.number}`)
          chapterCell.value = currentChapter || 'Sin capítulo'
          chapterCell.font = { bold: true, size: 11, color: { argb: '1E40AF' } }
          chapterCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } }
        }

        const dataRow = sheet.addRow([
          row.item,
          row.codigo,
          row.partida,
          row.unidad,
          row.metrado,
          '',  // capitulo already shown as group header
          row.referencia_norma,
          row.notas,
        ])

        // Metrado column as number
        dataRow.getCell(5).numFmt = '#,##0.00'
        dataRow.getCell(5).alignment = { horizontal: 'right' }
        dataRow.getCell(1).alignment = { horizontal: 'center' }
        dataRow.getCell(4).alignment = { horizontal: 'center' }
      }

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${sanitizeFilename(proyecto.nombre)}_planilla.xlsx"`,
        },
      })
    }

    return NextResponse.json({ error: 'Formato no soportado. Usa ?format=excel o ?format=json' }, { status: 400 })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Error al exportar' }, { status: 500 })
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, '').replace(/\s+/g, '_').slice(0, 100)
}
