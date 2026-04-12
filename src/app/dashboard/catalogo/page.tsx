'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Search } from 'lucide-react'

interface Partida {
  id: string
  nombre: string
  descripcion?: string
  unidad: string
}

export default function CatalogoPage() {
  const [partidas, setPartidas] = useState<Partida[]>([])
  const [filteredPartidas, setFilteredPartidas] = useState<Partida[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const getPartidas = async () => {
      try {
        const { data, error } = await supabase
          .from('partidas')
          .select('*')
          .order('nombre', { ascending: true })
          .limit(100)

        if (error) throw error
        setPartidas(data || [])
        setFilteredPartidas(data || [])
      } catch (error) {
        console.error('Error fetching partidas:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getPartidas()
  }, [])

  useEffect(() => {
    const filtered = partidas.filter((p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.descripcion?.toLowerCase().includes(search.toLowerCase())
    )
    setFilteredPartidas(filtered)
  }, [search, partidas])

  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Catálogo de Partidas</h1>
        <p className="text-muted-foreground">
          Explore las partidas estandarizadas disponibles
        </p>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="search">Buscar partida</Label>
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Buscar por nombre o descripción..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-center text-muted-foreground">Cargando catálogo...</div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {filteredPartidas.length} de {partidas.length} partidas
          </p>
          <div className="grid gap-3">
            {filteredPartidas.map((partida) => (
              <Card key={partida.id} className="hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-base">{partida.nombre}</CardTitle>
                      {partida.descripcion && (
                        <CardDescription className="line-clamp-2">
                          {partida.descripcion}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="outline">{partida.unidad}</Badge>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          {filteredPartidas.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                No se encontraron partidas que coincidan con tu búsqueda
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
