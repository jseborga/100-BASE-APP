'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, Plus, Trash2, Search, X, Save,
  FileText, MapPin, Building2, ChevronDown, ChevronRight,
} from 'lucide-react'

// --- Types ---
interface Pais {
  id: string
  codigo: string
  nombre: string
}

interface Proyecto {
  id: string
  nombre: string
  descripcion: string | null
  tipologia: string | null
  ubicacion: string | null
  estado: string | null
  pais_id: string
  paises: Pais | null
  created_at: string | null
}

interface PartidaCatalogo {
  id: string
  nombre: string
  unidad: string
  capitulo: string | null
  descripcion: string | null
}

interface ProyectoPartida {
  id: string
  proyecto_id: string
  partida_id: string
  cantidad: number | null
  metrado_manual: number | null
  metrado_bim: number | null
  metrado_final: number | null
  notas: string | null
  orden: number | null
  partidas: PartidaCatalogo | null
}

interface PartidaLocalizacion {
  codigo_local: string
  referencia_norma: string | null
}

type GroupedPartidas = Record<string, ProyectoPartida[]>

const ESTADOS: Record<string, { label: string; color: string }> = {
  activo: { label: 'Activo', color: 'bg-emerald-100 text-emerald-800' },
  borrador: { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
  completado: { label: 'Completado', color: 'bg-blue-100 text-blue-800' },
  archivado: { label: 'Archivado', color: 'bg-amber-100 text-amber-700' },
}

export default function ProyectoDetailPage() {
  const params = useParams()
  const proyectoId = params.id as string
  const supabase = createClient()

  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [partidas, setPartidas] = useState<ProyectoPartida[]>([])
  const [localizaciones, setLocalizaciones] = useState<Record<string, PartidaLocalizacion>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Add partida modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogResults, setCatalogResults] = useState<PartidaCatalogo[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedPartidas, setSelectedPartidas] = useState<Set<string>>(new Set())

  // Inline metrado editing
  const [editingMetrado, setEditingMetrado] = useState<string | null>(null)
  const [metradoValue, setMetradoValue] = useState('')

  // Collapsible chapters
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set())

  // --- Data fetching ---
  const fetchProyecto = useCallback(async (): Promise<Proyecto | null> => {
    try {
      const { data, error } = await supabase
        .from('proyectos')
        .select('*, paises(id, codigo, nombre)')
        .eq('id', proyectoId)
        .single()
      if (error) throw error
      const row = data as unknown as Record<string, unknown>
      const typed = {
        ...row,
        paises: row.paises as Pais | null,
      } as Proyecto
      setProyecto(typed)
      return typed
    } catch (error) {
      console.error('Error fetching proyecto:', error)
      return null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  const fetchPartidas = useCallback(async (paisId?: string) => {
    try {
      const { data, error } = await supabase
        .from('proyecto_partidas')
        .select('*, partidas(id, nombre, unidad, capitulo, descripcion)')
        .eq('proyecto_id', proyectoId)
        .order('orden', { ascending: true })
      if (error) throw error

      const rows = (data ?? []) as unknown as Record<string, unknown>[]
      const typed: ProyectoPartida[] = rows.map(row => ({
        ...row,
        partidas: row.partidas as PartidaCatalogo | null,
      } as ProyectoPartida))
      setPartidas(typed)

      // Fetch localizations for these partidas
      if (typed.length > 0 && paisId) {
        const partidaIds = typed.map(p => p.partida_id)
        const { data: estandarData } = await supabase
          .from('estandares')
          .select('id')
          .eq('pais_id', paisId)
          .limit(1)

        if (estandarData && estandarData.length > 0) {
          const { data: locData } = await supabase
            .from('partida_localizaciones')
            .select('partida_id, codigo_local, referencia_norma')
            .eq('estandar_id', estandarData[0].id)
            .in('partida_id', partidaIds)

          if (locData) {
            const locMap: Record<string, PartidaLocalizacion> = {}
            locData.forEach(l => {
              locMap[l.partida_id] = { codigo_local: l.codigo_local, referencia_norma: l.referencia_norma }
            })
            setLocalizaciones(locMap)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching partidas:', error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoId])

  useEffect(() => {
    const init = async () => {
      const proy = await fetchProyecto()
      if (proy) await fetchPartidas(proy.pais_id)
      setIsLoading(false)
    }
    if (proyectoId) init()
  }, [proyectoId, fetchProyecto, fetchPartidas])

  // --- Catalog search ---
  const searchCatalog = useCallback(async (query: string) => {
    if (query.length < 2) { setCatalogResults([]); return }
    setSearchLoading(true)
    try {
      const { data, error } = await supabase
        .from('partidas')
        .select('id, nombre, unidad, capitulo, descripcion')
        .or(`nombre.ilike.%${query}%,capitulo.ilike.%${query}%,descripcion.ilike.%${query}%`)
        .order('capitulo')
        .limit(50)
      if (error) throw error
      const assignedIds = new Set(partidas.map(p => p.partida_id))
      setCatalogResults((data ?? []).filter(p => !assignedIds.has(p.id)))
    } catch (error) {
      console.error('Error searching catalog:', error)
    } finally {
      setSearchLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidas])

  useEffect(() => {
    const timer = setTimeout(() => searchCatalog(catalogSearch), 300)
    return () => clearTimeout(timer)
  }, [catalogSearch, searchCatalog])

  // --- Actions ---
  const addPartidas = async () => {
    if (selectedPartidas.size === 0) return
    try {
      const maxOrden = partidas.reduce((max, p) => Math.max(max, p.orden || 0), 0)
      const inserts = Array.from(selectedPartidas).map((partidaId, i) => ({
        proyecto_id: proyectoId,
        partida_id: partidaId,
        orden: maxOrden + i + 1,
      }))

      const { error } = await supabase.from('proyecto_partidas').insert(inserts)
      if (error) throw error

      setShowAddModal(false)
      setSelectedPartidas(new Set())
      setCatalogSearch('')
      setCatalogResults([])
      await fetchPartidas(proyecto?.pais_id)
    } catch (error) {
      console.error('Error adding partidas:', error)
    }
  }

  const removePartida = async (ppId: string) => {
    try {
      const { error } = await supabase.from('proyecto_partidas').delete().eq('id', ppId)
      if (error) throw error
      setPartidas(prev => prev.filter(p => p.id !== ppId))
    } catch (error) {
      console.error('Error removing partida:', error)
    }
  }

  const saveMetrado = async (ppId: string) => {
    const value = parseFloat(metradoValue)
    if (isNaN(value)) return
    try {
      const { error } = await supabase
        .from('proyecto_partidas')
        .update({ metrado_manual: value, metrado_final: value })
        .eq('id', ppId)
      if (error) throw error
      setPartidas(prev => prev.map(p =>
        p.id === ppId ? { ...p, metrado_manual: value, metrado_final: value } : p
      ))
      setEditingMetrado(null)
    } catch (error) {
      console.error('Error saving metrado:', error)
    }
  }

  const toggleChapter = (chapter: string) => {
    setCollapsedChapters(prev => {
      const next = new Set(prev)
      next.has(chapter) ? next.delete(chapter) : next.add(chapter)
      return next
    })
  }

  const toggleSelectPartida = (id: string) => {
    setSelectedPartidas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const closeAddModal = () => {
    setShowAddModal(false)
    setSelectedPartidas(new Set())
    setCatalogSearch('')
    setCatalogResults([])
  }

  // --- Grouping ---
  const grouped: GroupedPartidas = {}
  partidas.forEach(pp => {
    const chapter = pp.partidas?.capitulo || 'Sin capítulo'
    if (!grouped[chapter]) grouped[chapter] = []
    grouped[chapter].push(pp)
  })
  const sortedChapters = Object.keys(grouped).sort()

  // --- Stats ---
  const totalPartidas = partidas.length
  const sinMetrado = partidas.filter(p => !p.metrado_final).length

  // --- Render ---
  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!proyecto) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Proyecto no encontrado</p>
        <Link href="/dashboard/proyectos">
          <Button variant="outline">Volver a proyectos</Button>
        </Link>
      </div>
    )
  }

  const pais = proyecto.paises
  const estado = ESTADOS[proyecto.estado || 'activo'] || ESTADOS.activo

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <Link href="/dashboard/proyectos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Proyectos
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{proyecto.nombre}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estado.color}`}>
              {estado.label}
            </span>
          </div>
          {proyecto.descripcion && (
            <p className="text-muted-foreground">{proyecto.descripcion}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {pais && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {pais.nombre}{proyecto.ubicacion ? ` · ${proyecto.ubicacion}` : ''}
              </span>
            )}
            {proyecto.tipologia && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {proyecto.tipologia}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{totalPartidas}</p>
            <p className="text-xs text-muted-foreground">Partidas asignadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{sinMetrado}</p>
            <p className="text-xs text-muted-foreground">Sin metrado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold">{sortedChapters.length}</p>
            <p className="text-xs text-muted-foreground">Capítulos</p>
          </CardContent>
        </Card>
      </div>

      {/* Partidas Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Planilla de metrados</CardTitle>
              <CardDescription className="mt-1">
                Partidas asignadas del catálogo con sus metrados
              </CardDescription>
            </div>
            <Button onClick={() => setShowAddModal(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Agregar partidas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {partidas.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No hay partidas asignadas a este proyecto</p>
              <Button variant="outline" onClick={() => setShowAddModal(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Agregar desde el catálogo
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedChapters.map(chapter => {
                const items = grouped[chapter]
                const isCollapsed = collapsedChapters.has(chapter)

                return (
                  <div key={chapter} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleChapter(chapter)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRight className="w-4 h-4" />
                          : <ChevronDown className="w-4 h-4" />
                        }
                        <span className="font-semibold text-sm">{chapter}</span>
                        <span className="text-xs text-muted-foreground">({items.length})</span>
                      </div>
                    </button>

                    {!isCollapsed && (
                      <div>
                        <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/20">
                          <div className="col-span-1">Código</div>
                          <div className="col-span-5">Partida</div>
                          <div className="col-span-1 text-center">Unidad</div>
                          <div className="col-span-2 text-right">Metrado</div>
                          <div className="col-span-2 text-right">Notas</div>
                          <div className="col-span-1"></div>
                        </div>
                        {items.map((pp, idx) => {
                          const partida = pp.partidas
                          const loc = localizaciones[pp.partida_id]
                          const isEditingThis = editingMetrado === pp.id

                          return (
                            <div
                              key={pp.id}
                              className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm border-b last:border-b-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-muted/10'} group/row hover:bg-blue-50/50 transition-colors`}
                            >
                              <div className="col-span-1">
                                {loc ? (
                                  <span className="font-mono text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                                    {loc.codigo_local}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{'\u2014'}</span>
                                )}
                              </div>

                              <div className="col-span-5">
                                <span className="font-medium">{partida?.nombre || pp.partida_id}</span>
                              </div>

                              <div className="col-span-1 text-center">
                                <Badge variant="outline" className="text-xs">{partida?.unidad || '\u2014'}</Badge>
                              </div>

                              <div className="col-span-2 text-right">
                                {isEditingThis ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-7 w-24 text-right text-sm"
                                      value={metradoValue}
                                      onChange={e => setMetradoValue(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') saveMetrado(pp.id)
                                        if (e.key === 'Escape') setEditingMetrado(null)
                                      }}
                                      autoFocus
                                    />
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => saveMetrado(pp.id)}>
                                      <Save className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingMetrado(pp.id)
                                      setMetradoValue(pp.metrado_final?.toString() || '')
                                    }}
                                    className="text-right hover:text-primary transition-colors"
                                    title="Click para editar metrado"
                                  >
                                    {pp.metrado_final != null ? (
                                      <span className="font-semibold">{Number(pp.metrado_final).toLocaleString('es-BO', { minimumFractionDigits: 2 })}</span>
                                    ) : (
                                      <span className="text-muted-foreground italic text-xs">Sin metrado</span>
                                    )}
                                  </button>
                                )}
                              </div>

                              <div className="col-span-2 text-right">
                                <span className="text-xs text-muted-foreground truncate block">{pp.notas || ''}</span>
                              </div>

                              <div className="col-span-1 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 opacity-0 group-hover/row:opacity-100 text-destructive hover:text-destructive transition-opacity"
                                  onClick={() => removePartida(pp.id)}
                                  title="Quitar partida"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Partidas Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeAddModal} />

          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-semibold">Agregar partidas del catálogo</h2>
                <p className="text-sm text-muted-foreground">Busca y selecciona partidas para asignar al proyecto</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeAddModal}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, capítulo o descripción..."
                  className="pl-10"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  autoFocus
                />
              </div>
              {selectedPartidas.size > 0 && (
                <p className="text-sm text-primary mt-2 font-medium">
                  {selectedPartidas.size} partida{selectedPartidas.size !== 1 ? 's' : ''} seleccionada{selectedPartidas.size !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-auto p-5">
              {searchLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : catalogResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {catalogSearch.length < 2
                    ? 'Escribe al menos 2 caracteres para buscar'
                    : 'No se encontraron partidas'
                  }
                </div>
              ) : (
                <div className="space-y-1">
                  {catalogResults.map(p => {
                    const isSelected = selectedPartidas.has(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleSelectPartida(p.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-transparent hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-sm">{p.nombre}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{p.capitulo}</span>
                              <Badge variant="outline" className="text-[10px] py-0">{p.unidad}</Badge>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t">
              <Button variant="outline" onClick={closeAddModal}>
                Cancelar
              </Button>
              <Button onClick={addPartidas} disabled={selectedPartidas.size === 0} className="gap-2">
                <Plus className="w-4 h-4" />
                Agregar {selectedPartidas.size > 0 ? `(${selectedPartidas.size})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
