'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Folder, BookOpen, Bot, Plus, ChevronRight,
  MapPin, BarChart3, Layers, Upload,
} from 'lucide-react'
import Link from 'next/link'

interface Stats {
  proyectos: {
    total: number
    por_estado: Record<string, number>
    por_pais: Record<string, number>
  }
  catalogo: {
    total_partidas: number
    total_paises: number
    total_estandares: number
  }
  asignaciones: {
    partidas_asignadas: number
    metrado_total: number
  }
  bim: {
    importaciones: number
  }
  recientes: {
    id: string
    nombre: string
    estado: string | null
    pais: string | null
    created_at: string
  }[]
}

const ESTADO_COLORS: Record<string, string> = {
  activo: 'bg-emerald-100 text-emerald-800',
  borrador: 'bg-gray-100 text-gray-700',
  completado: 'bg-blue-100 text-blue-800',
  archivado: 'bg-amber-100 text-amber-700',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) setStats(await res.json())
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Panel de control</h1>
        <p className="text-muted-foreground">
          ConstructionOS — Plataforma de estandarizacion de metrados
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mis proyectos</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '—' : stats?.proyectos.total ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats && Object.entries(stats.proyectos.por_estado)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${v} ${k}`)
                .join(', ') || 'Sin proyectos'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Catalogo master</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '—' : stats?.catalogo.total_partidas ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats ? `${stats.catalogo.total_paises} paises · ${stats.catalogo.total_estandares} estandares` : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Partidas asignadas</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '—' : stats?.asignaciones.partidas_asignadas ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              En todos mis proyectos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Importaciones BIM</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '—' : stats?.bim.importaciones ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Revit 2025
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recent projects */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Proyectos recientes</CardTitle>
              <Link href="/dashboard/proyectos">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Ver todos <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : stats?.recientes && stats.recientes.length > 0 ? (
              <div className="space-y-1">
                {stats.recientes.map(p => (
                  <Link key={p.id} href={`/dashboard/proyectos/${p.id}`}>
                    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted transition-colors group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Folder className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {p.nombre}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {p.pais && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" />
                                {p.pais}
                              </span>
                            )}
                            <span>{formatDate(p.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_COLORS[p.estado || 'activo'] || ESTADO_COLORS.activo}`}>
                          {p.estado || 'activo'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <Folder className="w-10 h-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Sin proyectos aun</p>
                <Link href="/dashboard/proyectos">
                  <Button size="sm" className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Crear proyecto
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: quick actions + country breakdown */}
        <div className="space-y-6">
          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Acciones rapidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/dashboard/proyectos" className="block">
                <Button variant="outline" className="w-full justify-start gap-2 h-9 text-sm">
                  <Plus className="w-4 h-4" />
                  Nuevo proyecto
                </Button>
              </Link>
              <Link href="/dashboard/catalogo" className="block">
                <Button variant="outline" className="w-full justify-start gap-2 h-9 text-sm">
                  <BookOpen className="w-4 h-4" />
                  Explorar catalogo
                </Button>
              </Link>
              <Link href="/dashboard/agentes" className="block">
                <Button variant="outline" className="w-full justify-start gap-2 h-9 text-sm">
                  <Bot className="w-4 h-4" />
                  Consultar agentes IA
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Country breakdown */}
          {stats && Object.keys(stats.proyectos.por_pais).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base">Por pais</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(stats.proyectos.por_pais)
                    .sort(([, a], [, b]) => b - a)
                    .map(([pais, count]) => (
                      <div key={pais} className="flex items-center justify-between">
                        <span className="text-sm flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          {pais}
                        </span>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metrado summary */}
          {stats && stats.asignaciones.metrado_total > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Metrado total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {stats.asignaciones.metrado_total.toLocaleString('es-BO', { maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Suma de metrados en todos los proyectos
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
