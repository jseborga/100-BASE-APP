'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, ArrowLeft, MapPin, Building2, Calendar, Bot, FileSpreadsheet } from 'lucide-react'
import Link from 'next/link'

interface Pais {
  id: string
  codigo: string
  nombre: string
}

interface ProyectoDetail {
  id: string
  nombre: string
  descripcion: string | null
  estado: string | null
  tipologia: string | null
  ubicacion: string | null
  pais_id: string
  paises: Pais | null
  created_at: string | null
}

interface PartidaProyecto {
  id: string
  partida_id: string
  metrado: number
  metrado_origen: string | null
  capitulo: string | null
  estado: string | null
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  activo: { label: 'Activo', color: 'bg-emerald-100 text-emerald-800' },
  borrador: { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
  completado: { label: 'Completado', color: 'bg-blue-100 text-blue-800' },
  archivado: { label: 'Archivado', color: 'bg-amber-100 text-amber-700' },
}

export default function ProyectoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const proyectoId = params.id as string

  const [proyecto, setProyecto] = useState<ProyectoDetail | null>(null)
  const [partidas, setPartidas] = useState<PartidaProyecto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const fetchData = async () => {
      try {
        // Fetch project with country info
        const { data: proyectoData, error: proyectoError } = await supabase
          .from('proyectos')
          .select('*, paises(id, codigo, nombre)')
          .eq('id', proyectoId)
          .single()

        if (proyectoError) throw proyectoError
        setProyecto(proyectoData as unknown as ProyectoDetail)

        // Fetch project partidas
        const { data: partidasData, error: partidasError } = await supabase
          .from('proyecto_partidas')
          .select('*')
          .eq('proyecto_id', proyectoId)
          .order('orden', { ascending: true })

        if (partidasError) throw partidasError
        setPartidas((partidasData || []) as unknown as PartidaProyecto[])
      } catch (err) {
        console.error('Error fetching proyecto:', err)
        setError(err instanceof Error ? err.message : 'Error al cargar el proyecto')
      } finally {
        setIsLoading(false)
      }
    }

    if (proyectoId) fetchData()
  }, [proyectoId])

  const formatDate = (date: string | null) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('es-BO', {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || !proyecto) {
    return (
      <div className="p-8 space-y-4">
        <Button variant="ghost" onClick={() => router.push('/dashboard/proyectos')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Volver a proyectos
        </Button>
        <Card className="p-12">
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold">Proyecto no encontrado</h2>
            <p className="text-muted-foreground text-sm">{error || 'El proyecto no existe o no tienes acceso'}</p>
          </div>
        </Card>
      </div>
    )
  }

  const estado = ESTADOS[proyecto.estado || 'activo'] || ESTADOS.activo

  return (
    <div className="p-8 space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push('/dashboard/proyectos')} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Volver a proyectos
      </Button>

      {/* Project header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{proyecto.nombre}</h1>
          <span className={'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + estado.color}>
            {estado.label}
          </span>
        </div>
        {proyecto.descripcion && (
          <p className="text-muted-foreground">{proyecto.descripcion}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {proyecto.paises && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {proyecto.paises.nombre}
              {proyecto.ubicacion ? ' \u00B7 ' + proyecto.ubicacion : ''}
            </span>
          )}
          {proyecto.tipologia && (
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {proyecto.tipologia}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatDate(proyecto.created_at)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:border-primary/40 transition-all cursor-pointer">
          <Link href={'/dashboard/agentes'}>
            <CardContent className="py-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-violet-100">
                <Bot className="w-6 h-6 text-violet-700" />
              </div>
              <div>
                <h3 className="font-semibold">Consultar agentes IA</h3>
                <p className="text-sm text-muted-foreground">Normativa, metrados, presupuesto</p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:border-primary/40 transition-all cursor-pointer">
          <CardContent className="py-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <Upload className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <h3 className="font-semibold">Importar desde BIM</h3>
              <p className="text-sm text-muted-foreground">Revit 2025 Add-in</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/40 transition-all cursor-pointer">
          <CardContent className="py-6 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-100">
              <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-semibold">Exportar planilla</h3>
              <p className="text-sm text-muted-foreground">Excel, JSON, Odoo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partidas Section */}
      <Card>
        <CardHeader>
          <CardTitle>Partidas del proyecto</CardTitle>
          <CardDescription>
            {partidas.length} partida{partidas.length !== 1 ? 's' : ''} asignada{partidas.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {partidas.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                No hay partidas asignadas a este proyecto.
              </p>
              <p className="text-sm text-muted-foreground">
                Importa desde BIM, consulta los agentes IA o agrega partidas manualmente desde el catalogo.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {partidas.map((p) => (
                <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div className="space-y-1">
                    <span className="text-sm font-medium">Partida: {p.partida_id}</span>
                    {p.capitulo && (
                      <p className="text-xs text-muted-foreground">{p.capitulo}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold">{p.metrado}</span>
                    {p.metrado_origen && (
                      <p className="text-xs text-muted-foreground">{p.metrado_origen}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
