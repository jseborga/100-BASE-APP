'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Folder } from 'lucide-react'

interface Proyecto {
  id: string
  nombre: string
  descripcion?: string
  estado: string
  pais_id: string
  created_at: string
}

export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const getProyectos = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const { data, error } = await supabase
            .from('proyectos')
            .select('*')
            .eq('propietario_id', user.id)
            .order('created_at', { ascending: false })

          if (error) throw error
          setProyectos(data || [])
        }
      } catch (error) {
        console.error('Error fetching proyectos:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getProyectos()
  }, [])

  if (isLoading) {
    return <div className="p-8 text-center">Cargando proyectos...</div>
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Proyectos</h1>
          <p className="text-muted-foreground">
            Gestiona tus proyectos de construcción
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo proyecto
        </Button>
      </div>

      {proyectos.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Folder className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Sin proyectos</h2>
            <p className="text-muted-foreground">
              Crea tu primer proyecto para empezar a trabajar con metrados
            </p>
            <Button>Crear proyecto</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {proyectos.map((proyecto) => (
            <Link key={proyecto.id} href={`/dashboard/proyectos/${proyecto.id}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle>{proyecto.nombre}</CardTitle>
                      {proyecto.descripcion && (
                        <CardDescription>{proyecto.descripcion}</CardDescription>
                      )}
                    </div>
                    <Badge>{proyecto.estado}</Badge>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
