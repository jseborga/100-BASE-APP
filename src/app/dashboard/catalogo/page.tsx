'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Hash,
  Tag as TagIcon,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface TagData {
  id: string
  dimension: string
  valor: string
}

interface PartidaTag {
  tag_id: string
  tags: TagData
}

interface PartidaLocalizacion {
  id: string
  codigo_local: string
  referencia_norma: string | null
}

interface Partida {
  id: string
  nombre: string
  descripcion: string | null
  unidad: string
  tipo: string | null
  capitulo: string | null
  es_compuesta: boolean | null
  partida_localizaciones: PartidaLocalizacion[]
  partida_tags: PartidaTag[]
}

interface GroupedPartidas {
  [capitulo: string]: Partida[]
}

// ============================================================
// Constants
// ============================================================

const DISPLAY_TAG_DIMENSIONS = ['frecuencia', 'especialidad']

// ============================================================
// Component
// ============================================================

export default function CatalogPage() {
  const supabase = createClient()

  const [partidas, setPartidas] = useState<Partida[]>([])
  const [groupedPartidas, setGroupedPartidas] = useState<GroupedPartidas>({})
  const [filteredPartidas, setFilteredPartidas] = useState<GroupedPartidas>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCapitulo, setSelectedCapitulo] = useState<string | null>(null)
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set()
  )

  // ============================================================
  // Fetch data from Supabase
  // ============================================================

  useEffect(() => {
    const fetchPartidas = async () => {
      try {
        setLoading(true)

        const { data, error } = await supabase
          .from('partidas')
          .select(
            `
            id,
            nombre,
            descripcion,
            unidad,
            tipo,
            capitulo,
            es_compuesta,
            partida_localizaciones(id, codigo_local, referencia_norma),
            partida_tags(tag_id, tags(id, dimension, valor))
          `
          )
          .order('capitulo', { ascending: true })
          .order('nombre', { ascending: true })

        if (error) {
          console.error('Error fetching partidas:', error)
          return
        }

        const boliviaPartidas = ((data ?? []) as unknown as Partida[]).filter((p) => {
          return (
            p.partida_localizaciones &&
            p.partida_localizaciones.length > 0
          )
        })

        setPartidas(boliviaPartidas)

        const grouped = groupPartidas(boliviaPartidas)
        setGroupedPartidas(grouped)
        setFilteredPartidas(grouped)

        const firstChapter = Object.keys(grouped)[0]
        if (firstChapter) {
          setExpandedChapters(new Set([firstChapter]))
        }
      } catch (err) {
        console.error('Unexpected error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPartidas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ============================================================
  // Helpers
  // ============================================================

  function groupPartidas(data: Partida[]): GroupedPartidas {
    const grouped: GroupedPartidas = {}
    data.forEach((partida) => {
      const chapter = partida.capitulo || 'Sin Cap\u00edtulo'
      if (!grouped[chapter]) {
        grouped[chapter] = []
      }
      grouped[chapter].push(partida)
    })
    return grouped
  }

  function filterData() {
    let filtered = partidas

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((p) => {
        const matchName = p.nombre.toLowerCase().includes(query)
        const matchDesc = p.descripcion?.toLowerCase().includes(query)
        const matchCode =
          p.partida_localizaciones &&
          p.partida_localizaciones.some((loc) =>
            loc.codigo_local.toLowerCase().includes(query)
          )
        return matchName || matchDesc || matchCode
      })
    }

    if (selectedCapitulo) {
      filtered = filtered.filter(
        (p) => (p.capitulo || 'Sin Cap\u00edtulo') === selectedCapitulo
      )
    }

    const grouped = groupPartidas(filtered)
    setFilteredPartidas(grouped)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { filterData() }, [searchQuery, selectedCapitulo])

  function toggleChapter(chapter: string) {
    const newExpanded = new Set(expandedChapters)
    if (newExpanded.has(chapter)) {
      newExpanded.delete(chapter)
    } else {
      newExpanded.add(chapter)
    }
    setExpandedChapters(newExpanded)
  }

  function getBoliviaCodeForPartida(partida: Partida): string | null {
    const localization = partida.partida_localizaciones?.[0]
    return localization?.codigo_local || null
  }

  function getNormaReferencia(partida: Partida): string | null {
    const localization = partida.partida_localizaciones?.[0]
    return localization?.referencia_norma || null
  }

  function getDisplayTags(partida: Partida): TagData[] {
    if (!partida.partida_tags) return []
    return partida.partida_tags
      .map((pt) => pt.tags)
      .filter((tag) => tag && DISPLAY_TAG_DIMENSIONS.includes(tag.dimension))
      .slice(0, 3)
  }

  function getTagColor(dimension: string): string {
    const colors: Record<string, string> = {
      frecuencia: 'bg-blue-100 text-blue-800',
      especialidad: 'bg-purple-100 text-purple-800',
      tipo_proyecto: 'bg-green-100 text-green-800',
      fase: 'bg-orange-100 text-orange-800',
      pais: 'bg-red-100 text-red-800',
      region: 'bg-cyan-100 text-cyan-800',
      origen_bim: 'bg-yellow-100 text-yellow-800',
    }
    return colors[dimension] || 'bg-gray-100 text-gray-800'
  }

  // ============================================================
  // Computed values
  // ============================================================

  const capitalosArray = Object.keys(groupedPartidas).sort()
  const totalPartidas = partidas.length
  const partidasConCodigo = partidas.filter(
    (p) => p.partida_localizaciones && p.partida_localizaciones.length > 0
  ).length

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando cat\u00e1logo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Cat\u00e1logo de Partidas
            </h1>
            <p className="text-muted-foreground mt-2">
              {totalPartidas} partidas \u00b7 {capitalosArray.length} cap\u00edtulos \u00b7 Bolivia NB
            </p>
          </div>
          <BookOpen className="w-12 h-12 text-muted-foreground opacity-20" />
        </div>
      </div>

      {/* STATS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Partidas</p>
                <p className="text-3xl font-bold mt-1">{totalPartidas}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Con C\u00f3digo NB</p>
                <p className="text-3xl font-bold mt-1">{partidasConCodigo}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Hash className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cap\u00edtulos</p>
                <p className="text-3xl font-bold mt-1">{capitalosArray.length}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <TagIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEARCH & FILTERS */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Buscar por nombre, c\u00f3digo o descripci\u00f3n</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Ej: muro, 01.03, tarrajeo..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Filtrar por Cap\u00edtulo</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCapitulo === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCapitulo(null)}
              >
                Todos
              </Button>
              {capitalosArray.map((chapter) => {
                const count = groupedPartidas[chapter]?.length ?? 0
                return (
                  <Button
                    key={chapter}
                    variant={selectedCapitulo === chapter ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setSelectedCapitulo(selectedCapitulo === chapter ? null : chapter)
                    }
                  >
                    {chapter.split(' \u00b7 ')[0]} ({count})
                  </Button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CONTENT BY CHAPTER */}
      <div className="space-y-4">
        {capitalosArray.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">
                No se encontraron partidas que coincidan con tu b\u00fasqueda.
              </p>
            </CardContent>
          </Card>
        ) : (
          capitalosArray.map((chapter) => {
            const chapPartidas = filteredPartidas[chapter] || []
            const isExpanded = expandedChapters.has(chapter)

            return (
              <Card key={chapter} className="overflow-hidden">
                <button
                  onClick={() => toggleChapter(chapter)}
                  className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div className="text-left">
                      <h3 className="font-semibold text-base">{chapter}</h3>
                      <p className="text-sm text-muted-foreground">
                        {chapPartidas.length}{' '}
                        {chapPartidas.length === 1 ? 'partida' : 'partidas'}
                      </p>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="divide-y">
                      {chapPartidas.map((partida, idx) => {
                        const nbCode = getBoliviaCodeForPartida(partida)
                        const normaRef = getNormaReferencia(partida)
                        const displayTags = getDisplayTags(partida)

                        return (
                          <div
                            key={partida.id}
                            className={`py-4 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                          >
                            <div className="flex items-start gap-4 mb-2">
                              {nbCode && (
                                <div className="font-mono font-bold text-lg text-blue-600 min-w-fit">
                                  {nbCode}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm leading-tight">
                                  {partida.nombre}
                                </h4>
                              </div>
                              <Badge variant="secondary" className="min-w-fit">
                                {partida.unidad}
                              </Badge>
                            </div>

                            {partida.descripcion && (
                              <p className="text-xs text-muted-foreground ml-0 mb-2 leading-relaxed">
                                {partida.descripcion}
                              </p>
                            )}

                            <div className="flex items-center justify-between gap-3 flex-wrap mt-2">
                              <div>
                                {normaRef && (
                                  <p className="text-xs text-slate-500">
                                    <span className="font-medium">Norma:</span>{' '}
                                    {normaRef}
                                  </p>
                                )}
                              </div>

                              {displayTags.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  {displayTags.map((tag) => (
                                    <Badge
                                      key={tag.id}
                                      variant="outline"
                                      className={`text-xs ${getTagColor(tag.dimension)}`}
                                    >
                                      {tag.valor}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* FOOTER */}
      <Card className="bg-slate-50">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Este cat\u00e1logo contiene el est\u00e1ndar NB de Bolivia. Cada partida puede
            ser utilizada en m\u00faltiples proyectos con metrados espec\u00edficos. Para
            agregar una nueva partida, utiliza el formulario de sugerencias.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
