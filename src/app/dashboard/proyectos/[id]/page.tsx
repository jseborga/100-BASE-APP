'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload } from 'lucide-react'

interface ProyectoDetail {
  id: string
  nombre: string
  descripcion?: string
  estado: string
}

interface PartidaProyecto {
  id: string
  partida_id: string
  metrado_final: number
}

export default function ProyectoDetailPage() {
  const params = useParams()
  const proyectoId = params.id as string

  const [proyecto, setProyecto] = useState<ProyectoDetail | null>(null)
  const [partidas, setPartidas] = useState<PartidaProyecto[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const getProyectoData = async () => {
      try {
        // Get proyecto
        const { data: proyectoData, error: proyectoError } = await supabase
          .from('proyectos')
          .select('*')
          .eq('id', proyectoId)
          .single()

        if (proyectoError) throw proyectoError
        setProyecto(proyectoData)

        // Get proyecto partidas
        const { data: partidasData, error: partidasError } = await supabase
          .from('proyecto_partidas')
          .select('*')
          .eq('proyecto_id', proyectoId)

        if (partidasError) throw partidasError
        setPartidas(partidasData || [])
      } catch (error) {
        console.error('Error fetching proyecto:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (proyectoId) {
      getProyectoData()
    }
  }, [proyectoId])

  if (isLoading) {
    return <div className="p-8 text-center">Cargando proyecto...</div>
  }

  if (!proyecto) {
    return <div className="p-8 text-center">Proyecto no encontrado</div>
  }

  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{proyecto.nombre}</h1>
        {proyecto.descripcion && (
          <p className="text-muted-foreground">{proyecto.descripcion}</p>
        )}
      </div>

      <div className="grid gap-4">
        {/* Project Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado del proyecto</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>{proyecto.estado}</Badge>
          </CardContent>
        </Card>

        {/* BIM Import Section */}
        <Card>
          <CardHeader>
            <CardTitle>Importar desde BIM</CardTitle>
            <CardDescription>
              Sube un archivo de Revit o usa el Add-in para mapear elementos a partidas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="gap-2">
              <Upload className="w-4 h-4" />
              Importar archivo BIM
            </Button>
          </CardContent>
        </Card>

        {/* Partidas Section */}
        <Card>
          <CardHeader>
            <CardTitle>Partidas del proyecto</CardTitle>
            <CardDescription>
              {partidas.length} partida{partidas.length !== 1 ? 's' : ''} asignada
              {partidas.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {partidas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay partidas asignadas. Importa desde BIM o agrega manualmente.
              </p>
            ) : (
              <div className="space-y-2">
                {partidas.map((p) => (
                  <div key={p.id} className="flex justify-between items-center p-3 border rounded">
                    <span>Partida ID: {p.partida_id}</span>
                    <span className="text-sm font-semibold">{p.metrado_final}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
