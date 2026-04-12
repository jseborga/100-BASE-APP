'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
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
  PackagePlus,
  Check,
  Loader2,
  Filter,
  X,
  Globe,
  ArrowRight,
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
  peso: number | null
  tags: TagData
}

interface EstandarInfo {
  id: string
  codigo: string
  nombre: string
  paises: { codigo: string; nombre: string } | null
}

interface PartidaLocalizacion {
  id: string
  codigo_local: string
  referencia_norma: string | null
  estandares: EstandarInfo | null
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

interface Proyecto {
  id: string
  nombre: string
  estado: string | null
  paises?: { codigo: string; nombre: string } | null
}

// ============================================================
// Helpers
// ============================================================

function getLocForStandard(p: Partida, estandarCodigo?: string): PartidaLocalizacion | null {
  if (!p.partida_localizaciones?.length) return null
  if (estandarCodigo) {
    return p.partida_localizaciones.find(l => l.estandares?.codigo === estandarCodigo) || null
  }
  return p.partida_localizaciones[0]
}

function getCodigoLocal(p: Partida, estandarCodigo?: string): string {
  return getLocForStandard(p, estandarCodigo)?.codigo_local || '99.99'
}

function parseCode(code: string): [number, number] {
  const parts = code.split('.')
  return [parseInt(parts[0]) || 99, parseInt(parts[1]) || 99]
}

function compareByCode(a: Partida, b: Partida, std?: string): number {
  const [aMaj, aMin] = parseCode(getCodigoLocal(a, std))
  const [bMaj, bMin] = parseCode(getCodigoLocal(b, std))
  if (aMaj !== bMaj) return aMaj - bMaj
  return aMin - bMin
}

function getChapterNumber(p: Partida, std?: string): string {
  return getCodigoLocal(p, std).split('.')[0] || '99'
}

function hasTag(p: Partida, dimension: string, valor: string): boolean {
  return p.partida_tags?.some(
    pt => pt.tags?.dimension === dimension && pt.tags?.valor === valor
  ) ?? false
}

function collectTagValues(partidas: Partida[], dimension: string): string[] {
  const values = new Set<string>()
  for (const p of partidas) {
    for (const pt of (p.partida_tags || [])) {
      if (pt.tags?.dimension === dimension) values.add(pt.tags.valor)
    }
  }
  return Array.from(values).sort()
}

const TAG_COLORS: Record<string, string> = {
  frecuencia: 'bg-blue-100 text-blue-800',
  especialidad: 'bg-purple-100 text-purple-800',
  tipo_proyecto: 'bg-green-100 text-green-800',
}

const FRECUENCIA_LABELS: Record<string, string> = {
  muy_comun: 'Muy comun', comun: 'Comun', especial: 'Especial', raro: 'Raro',
}
const FRECUENCIA_ORDER = ['muy_comun', 'comun', 'especial', 'raro']

const TIPO_LABELS: Record<string, string> = {
  residencial_multifamiliar: 'Residencial multifamiliar',
  residencial_unifamiliar: 'Residencial unifamiliar',
  comercial_oficinas: 'Comercial / Oficinas',
  industrial_galpon: 'Industrial / Galpon',
  educativo_salud: 'Educativo / Salud',
  infraestructura_vial: 'Infraestructura vial',
  remodelacion_comercial: 'Remodelacion comercial',
  civil_vial: 'Civil vial',
}

const STANDARD_COLORS: Record<string, string> = {
  NB: 'bg-red-100 text-red-800 border-red-200',
  RNE: 'bg-amber-100 text-amber-800 border-amber-200',
  ABNT: 'bg-green-100 text-green-800 border-green-200',
  CSI: 'bg-blue-100 text-blue-800 border-blue-200',
  CIRSOC: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  NCh: 'bg-violet-100 text-violet-800 border-violet-200',
}

// ============================================================
// Component
// ============================================================

export default function CatalogPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const proyectoParam = searchParams.get('proyecto')

  const [allPartidas, setAllPartidas] = useState<Partida[]>([])
  const [loading, setLoading] = useState(true)

  // Available standards from data
  const [availableStandards, setAvailableStandards] = useState<{ codigo: string; nombre: string; pais: string }[]>([])
  const [selectedStandard, setSelectedStandard] = useState<string>('') // estandar codigo

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTipoProyecto, setSelectedTipoProyecto] = useState('')
  const [selectedFrecuencia, setSelectedFrecuencia] = useState('')
  const [selectedChapter, setSelectedChapter] = useState('')

  // Selection & import
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [selectedProyectoId, setSelectedProyectoId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [showImportPanel, setShowImportPanel] = useState(false)

  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())

  // ============================================================
  // Fetch
  // ============================================================

  useEffect(() => {
    async function fetchPartidas() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('partidas')
          .select(`
            id, nombre, descripcion, unidad, tipo, capitulo, es_compuesta,
            partida_localizaciones(
              id, codigo_local, referencia_norma,
              estandares(id, codigo, nombre, paises(codigo, nombre))
            ),
            partida_tags(tag_id, peso, tags(id, dimension, valor))
          `)

        if (error) { console.error('Error:', error); return }

        const partidas = (data ?? []) as unknown as Partida[]

        // Only keep partidas that have at least one localization
        const withLoc = partidas.filter(p => p.partida_localizaciones?.length > 0)

        setAllPartidas(withLoc)

        // Collect available standards
        const stds = new Map<string, { codigo: string; nombre: string; pais: string }>()
        for (const p of withLoc) {
          for (const loc of p.partida_localizaciones) {
            if (loc.estandares && !stds.has(loc.estandares.codigo)) {
              stds.set(loc.estandares.codigo, {
                codigo: loc.estandares.codigo,
                nombre: loc.estandares.nombre,
                pais: loc.estandares.paises?.nombre || '',
              })
            }
          }
        }
        const stdList = Array.from(stds.values())
        setAvailableStandards(stdList)

        // Auto-select first standard
        if (stdList.length > 0) {
          setSelectedStandard(stdList[0].codigo)
        }

        // Expand first chapter
        if (withLoc.length > 0) {
          const firstStd = stdList[0]?.codigo
          const sorted = [...withLoc].sort((a, b) => compareByCode(a, b, firstStd))
          setExpandedChapters(new Set([getChapterNumber(sorted[0], firstStd)]))
        }
      } catch (err) { console.error('Unexpected error:', err) }
      finally { setLoading(false) }
    }
    fetchPartidas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function fetchProyectos() {
      try {
        const res = await fetch('/api/proyectos')
        if (res.ok) {
          const data = await res.json()
          setProyectos(data as Proyecto[])

          // Pre-select from URL param, or fallback to first active project
          if (proyectoParam) {
            const match = (data as Proyecto[]).find(p => p.id === proyectoParam)
            if (match) {
              setSelectedProyectoId(match.id)
              setShowImportPanel(true)
            }
          } else {
            const active = (data as Proyecto[]).find(p => p.estado === 'activo')
            if (active) setSelectedProyectoId(active.id)
          }
        }
      } catch (err) { console.error(err) }
    }
    fetchProyectos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ============================================================
  // Derived data
  // ============================================================

  const currentStd = selectedStandard || availableStandards[0]?.codigo || ''
  const currentStdInfo = availableStandards.find(s => s.codigo === currentStd)

  // Filter partidas by standard first (only those with localization for this standard)
  const partidasForStandard = useMemo(() => {
    if (!currentStd) return allPartidas
    return allPartidas.filter(p =>
      p.partida_localizaciones.some(l => l.estandares?.codigo === currentStd)
    )
  }, [allPartidas, currentStd])

  const tipoProyectoValues = useMemo(
    () => collectTagValues(partidasForStandard, 'tipo_proyecto'),
    [partidasForStandard]
  )

  const frecuenciaValues = useMemo(() => {
    const vals = collectTagValues(partidasForStandard, 'frecuencia')
    return FRECUENCIA_ORDER.filter(v => vals.includes(v))
  }, [partidasForStandard])

  // Apply filters
  const filteredPartidas = useMemo(() => {
    let result = partidasForStandard

    if (selectedTipoProyecto) {
      result = result.filter(p => hasTag(p, 'tipo_proyecto', selectedTipoProyecto))
    }
    if (selectedFrecuencia) {
      result = result.filter(p => hasTag(p, 'frecuencia', selectedFrecuencia))
    }
    if (selectedChapter) {
      result = result.filter(p => getChapterNumber(p, currentStd) === selectedChapter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => {
        const matchName = p.nombre.toLowerCase().includes(q)
        const matchDesc = p.descripcion?.toLowerCase().includes(q)
        const matchCode = p.partida_localizaciones?.some(
          loc => loc.codigo_local.toLowerCase().includes(q)
        )
        return matchName || matchDesc || matchCode
      })
    }

    // Sort by codigo_local for the active standard
    return [...result].sort((a, b) => compareByCode(a, b, currentStd))
  }, [partidasForStandard, selectedTipoProyecto, selectedFrecuencia, selectedChapter, searchQuery, currentStd])

  // Group by chapter
  const chapters = useMemo(() => {
    const map = new Map<string, { number: string; name: string; partidas: Partida[] }>()
    for (const p of filteredPartidas) {
      const num = getChapterNumber(p, currentStd)
      if (!map.has(num)) {
        map.set(num, { number: num, name: p.capitulo || `Capitulo ${num}`, partidas: [] })
      }
      map.get(num)!.partidas.push(p)
    }
    return Array.from(map.values()).sort((a, b) => parseInt(a.number) - parseInt(b.number))
  }, [filteredPartidas, currentStd])

  const allChapterNumbers = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of partidasForStandard) {
      const num = getChapterNumber(p, currentStd)
      if (!map.has(num)) map.set(num, p.capitulo || `Capitulo ${num}`)
    }
    return Array.from(map.entries()).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  }, [partidasForStandard, currentStd])

  // ============================================================
  // Actions
  // ============================================================

  const toggleChapter = useCallback((n: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n); else next.add(n)
      return next
    })
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const selectAllInChapter = useCallback((partidas: Partida[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSel = partidas.every(p => next.has(p.id))
      if (allSel) partidas.forEach(p => next.delete(p.id))
      else partidas.forEach(p => next.add(p.id))
      return next
    })
  }, [])

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(prev => {
      const allIds = filteredPartidas.map(p => p.id)
      if (allIds.every(id => prev.has(id))) return new Set()
      return new Set(allIds)
    })
  }, [filteredPartidas])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setShowImportPanel(false)
    setImportResult(null)
  }, [])

  const handleImport = useCallback(async () => {
    if (!selectedProyectoId || selectedIds.size === 0) return
    setImporting(true); setImportResult(null)
    try {
      const res = await fetch(`/api/proyectos/${selectedProyectoId}/partidas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partida_ids: Array.from(selectedIds) }),
      })
      const data = await res.json()
      if (!res.ok) { setImportResult(`Error: ${data.error}`); return }
      setImportResult(data.message)
      if (data.imported > 0) {
        setTimeout(() => { setSelectedIds(new Set()); setShowImportPanel(false); setImportResult(null) }, 3000)
      }
    } catch { setImportResult('Error de conexion') }
    finally { setImporting(false) }
  }, [selectedProyectoId, selectedIds])

  const clearFilters = useCallback(() => {
    setSearchQuery(''); setSelectedTipoProyecto(''); setSelectedFrecuencia(''); setSelectedChapter('')
  }, [])

  const hasActiveFilters = searchQuery || selectedTipoProyecto || selectedFrecuencia || selectedChapter

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando catalogo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Catalogo de Partidas</h1>
          <p className="text-muted-foreground mt-2">
            {allPartidas.length} partidas &middot; {availableStandards.length} estandar{availableStandards.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <BookOpen className="w-12 h-12 text-muted-foreground opacity-20" />
      </div>

      {/* STANDARD / COUNTRY SELECTOR */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Globe className="w-4 h-4" /> Estandar / Pais
            </Label>
            <div className="flex gap-2 flex-wrap">
              {availableStandards.map(std => (
                <Button
                  key={std.codigo}
                  variant={currentStd === std.codigo ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectedStandard(std.codigo)
                    setSelectedChapter('')
                  }}
                  className="gap-2"
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    STANDARD_COLORS[std.codigo]?.split(' ')[0] || 'bg-gray-300'
                  }`} />
                  {std.codigo} — {std.pais}
                </Button>
              ))}
            </div>
            {currentStdInfo && (
              <p className="text-xs text-muted-foreground">
                {currentStdInfo.nombre} &middot; {partidasForStandard.length} partidas &middot; {allChapterNumbers.length} capitulos
              </p>
            )}
            {availableStandards.length > 0 && availableStandards.length < 6 && (
              <p className="text-xs text-muted-foreground italic">
                Cargados: {availableStandards.map(s => `${s.pais} (${s.codigo})`).join(', ')}.
                {availableStandards.length < 6 && ' Proximamente mas paises.'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* STATS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Partidas ({currentStd})</p>
                <p className="text-3xl font-bold mt-1">{partidasForStandard.length}</p>
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
                <p className="text-sm font-medium text-muted-foreground">Filtradas</p>
                <p className="text-3xl font-bold mt-1">{filteredPartidas.length}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Filter className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Seleccionadas</p>
                <p className="text-3xl font-bold mt-1">{selectedIds.size}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Check className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTERS */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Buscar por nombre, codigo o descripcion</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="search" placeholder="Ej: muro, 01.03, tarrajeo..." className="pl-10"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de proyecto</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedTipoProyecto} onChange={e => setSelectedTipoProyecto(e.target.value)}>
                <option value="">Todos los tipos</option>
                {tipoProyectoValues.map(v => <option key={v} value={v}>{TIPO_LABELS[v] || v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Frecuencia de uso</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedFrecuencia} onChange={e => setSelectedFrecuencia(e.target.value)}>
                <option value="">Todas las frecuencias</option>
                {frecuenciaValues.map(v => <option key={v} value={v}>{FRECUENCIA_LABELS[v] || v}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Capitulo</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)}>
                <option value="">Todos los capitulos</option>
                {allChapterNumbers.map(([num, name]) => (
                  <option key={num} value={num}>{num.padStart(2, '0')} - {name}</option>
                ))}
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Filtros:</span>
              {selectedTipoProyecto && (
                <Badge variant="secondary" className="gap-1">
                  {TIPO_LABELS[selectedTipoProyecto] || selectedTipoProyecto}
                  <button onClick={() => setSelectedTipoProyecto('')}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              {selectedFrecuencia && (
                <Badge variant="secondary" className="gap-1">
                  {FRECUENCIA_LABELS[selectedFrecuencia] || selectedFrecuencia}
                  <button onClick={() => setSelectedFrecuencia('')}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              {selectedChapter && (
                <Badge variant="secondary" className="gap-1">
                  Cap. {selectedChapter.padStart(2, '0')}
                  <button onClick={() => setSelectedChapter('')}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="gap-1">
                  &quot;{searchQuery}&quot;
                  <button onClick={() => setSearchQuery('')}><X className="w-3 h-3" /></button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-6">Limpiar</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* IMPORT BAR */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Badge className="text-sm">{selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}</Badge>
                <Button variant="ghost" size="sm" onClick={clearSelection} className="text-xs">Deseleccionar</Button>
                <Button variant="ghost" size="sm" onClick={selectAllFiltered} className="text-xs">
                  {filteredPartidas.every(p => selectedIds.has(p.id)) ? 'Deseleccionar filtradas' : 'Seleccionar todas'}
                </Button>
              </div>
              <Button onClick={() => setShowImportPanel(!showImportPanel)} className="gap-2">
                <PackagePlus className="w-4 h-4" /> Importar al proyecto
              </Button>
            </div>

            {showImportPanel && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-background border text-xs text-muted-foreground">
                  <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Flujo de importacion:</p>
                    <p>1. Selecciona partidas del catalogo usando los checkboxes</p>
                    <p>2. Elige el proyecto destino abajo</p>
                    <p>3. Click en &quot;Importar&quot; — las partidas se agregan a <span className="font-mono">proyecto_partidas</span> con orden automatico</p>
                    <p>4. Ve al proyecto para ingresar metrados (manual o BIM)</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Proyecto destino</Label>
                    {proyectos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No tienes proyectos. Crea uno primero.</p>
                    ) : (
                      <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={selectedProyectoId} onChange={e => setSelectedProyectoId(e.target.value)}>
                        <option value="">Seleccionar proyecto...</option>
                        {proyectos.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {p.paises ? `(${p.paises.codigo})` : ''} — {p.estado}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <Button onClick={handleImport} disabled={importing || !selectedProyectoId || selectedIds.size === 0} className="gap-2">
                    {importing
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                      : <><PackagePlus className="w-4 h-4" /> Importar {selectedIds.size} partida{selectedIds.size !== 1 ? 's' : ''}</>
                    }
                  </Button>
                </div>
                {importResult && (
                  <p className={`text-sm font-medium ${importResult.startsWith('Error') ? 'text-destructive' : 'text-green-600'}`}>
                    {importResult}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* CHAPTERS + PARTIDAS */}
      <div className="space-y-4">
        {chapters.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No se encontraron partidas con los filtros seleccionados.</p>
            </CardContent>
          </Card>
        ) : (
          chapters.map(chapter => {
            const isExpanded = expandedChapters.has(chapter.number)
            const allChapterSelected = chapter.partidas.every(p => selectedIds.has(p.id))
            const someChapterSelected = chapter.partidas.some(p => selectedIds.has(p.id))

            return (
              <Card key={chapter.number} className="overflow-hidden">
                <div className="flex items-center bg-slate-50 hover:bg-slate-100 transition-colors">
                  <label className="flex items-center justify-center w-12 h-full py-4 cursor-pointer">
                    <input type="checkbox" checked={allChapterSelected}
                      ref={el => { if (el) el.indeterminate = someChapterSelected && !allChapterSelected }}
                      onChange={() => selectAllInChapter(chapter.partidas)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                  </label>
                  <button onClick={() => toggleChapter(chapter.number)} className="flex-1 py-4 pr-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded
                        ? <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        : <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      }
                      <div className="text-left">
                        <h3 className="font-semibold text-base">
                          <span className="text-primary font-mono mr-2">{chapter.number.padStart(2, '0')}</span>
                          {chapter.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {chapter.partidas.length} partida{chapter.partidas.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="divide-y">
                      {chapter.partidas.map((partida, idx) => {
                        const loc = getLocForStandard(partida, currentStd)
                        const code = loc?.codigo_local || '??'
                        const normaRef = loc?.referencia_norma
                        const stdCode = loc?.estandares?.codigo
                        const isSelected = selectedIds.has(partida.id)

                        const displayTags = (partida.partida_tags || [])
                          .map(pt => pt.tags)
                          .filter(t => t && (t.dimension === 'frecuencia' || t.dimension === 'especialidad'))
                          .slice(0, 3)

                        return (
                          <div key={partida.id}
                            className={`py-3 flex items-start gap-3 ${
                              isSelected ? 'bg-primary/5' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            }`}>
                            <label className="flex items-center justify-center w-8 pt-1 cursor-pointer flex-shrink-0">
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(partida.id)}
                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" />
                            </label>

                            <div className="font-mono font-bold text-sm text-blue-600 min-w-[50px] pt-0.5">{code}</div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-medium text-sm leading-tight">{partida.nombre}</h4>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {stdCode && (
                                    <Badge variant="outline" className={`text-[10px] ${STANDARD_COLORS[stdCode] || ''}`}>
                                      {stdCode}
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs">{partida.unidad}</Badge>
                                </div>
                              </div>

                              {partida.descripcion && (
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{partida.descripcion}</p>
                              )}

                              <div className="flex items-center justify-between gap-3 flex-wrap mt-1.5">
                                {normaRef && (
                                  <p className="text-xs text-slate-500">
                                    <span className="font-medium">Norma:</span> {normaRef}
                                  </p>
                                )}
                                {displayTags.length > 0 && (
                                  <div className="flex gap-1 flex-wrap">
                                    {displayTags.map(tag => (
                                      <Badge key={tag.id} variant="outline"
                                        className={`text-[10px] ${TAG_COLORS[tag.dimension] || ''}`}>
                                        {tag.dimension === 'frecuencia' ? (FRECUENCIA_LABELS[tag.valor] || tag.valor) : tag.valor}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
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
            Catalogo master de partidas de construccion. Cada partida esta localizada por estandar y pais
            con su codigo normativo. Selecciona partidas e importalas a un proyecto para comenzar los computos de metrados.
            {availableStandards.length < 6 && ` Paises activos: ${availableStandards.map(s => s.pais).join(', ')}.`}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
