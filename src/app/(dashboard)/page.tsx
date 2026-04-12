'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, Folder, BookOpen, Tag } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalProyectos: 0,
    totalPartidas: 0,
    totalTags: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const getStats = async () => {
      try {
        const [proyectosRes, partidasRes, tagsRes] = await Promise.all([
          supabase.from('proyectos').select('id', { count: 'exact' }),
          supabase.from('partidas').select('id', { count: 'exact' }),
          supabase.from('tags').select('id', { count: 'exact' }),
        ])

        setStats({
          totalProyectos: proyectosRes.count || 0,
          totalPartidas: partidasRes.count || 0,
          totalTags: tagsRes.count || 0,
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getStats()
  }, [])

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Panel de control</h1>
        <p className="text-muted-foreground">
          Bienvenido a ConstructionOS, plataforma de estandarización de metrados
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proyectos</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '-' : stats.totalProyectos}
            </div>
            <p className="text-xs text-muted-foreground">
              Proyectos activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partidas</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '-' : stats.totalPartidas}
            </div>
            <p className="text-xs text-muted-foreground">
              En el catálogo master
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tags</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '-' : stats.totalTags}
            </div>
            <p className="text-xs text-muted-foreground">
              Vocabulario de IA
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Acciones rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Nuevo Proyecto</h3>
                <p className="text-sm text-muted-foreground">
                  Crea un nuevo proyecto con metrados personalizados
                </p>
              </div>
              <Link href="/dashboard/proyectos">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Crear proyecto
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Explorar Catálogo</h3>
                <p className="text-sm text-muted-foreground">
                  Navega todas las partidas estandarizadas disponibles
                </p>
              </div>
              <Link href="/dashboard/catalogo">
                <Button variant="outline" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  Ver catálogo
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Características principales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { title: 'Catálogo Master', desc: 'Partidas estandarizadas por país y normativa' },
            { title: 'BIM Integration', desc: 'Mapeo automático de elementos Revit a partidas' },
            { title: 'Asistencia IA', desc: '6 agentes especializados para metrados y presupuestos' },
            { title: 'Exportación', desc: 'Genera planillas para Odoo, S10 o Excel' },
          ].map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
