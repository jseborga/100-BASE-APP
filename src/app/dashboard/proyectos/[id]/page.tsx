'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, MapPin, Building2, Calendar, Bot, FileSpreadsheet,
  Upload, Trash2, Check, X, Pencil, Plus, ChevronDown, ChevronRight, Download,
  LayoutTemplate, Loader2, Box, RefreshCw,
  Search, Layers, Link2,
} from 'lucide-react'
import Link from 'next/link'
import BimLinkModal from '@/components/bim-link-modal'

interface Pais {
  id: string
  codigo: string
  nombre: string
}

interface PartidaLocalizacion {
  codigo_local: string
  referencia_norma: string | null
  estandar_id: string
}

interface PartidaInfo {
  id: string
  nombre: string
  unidad: string
  capitulo: string | null
  partida_localizaciones?: PartidaLocalizacion[]
}

interface PartidaProyecto {
  id: string
  partida_id: string
  metrado_manual: number | null
  metrado_bim: number | null
  metrado_final: number | null
  cantidad: number
  notas: string | null
  orden: number | null
  partidas: PartidaInfo | null
}

interface ProyectoDetail {
  id: string
  nombre: string
  descripcion: string | null
  estado: string | null
  tipologia: string | null
  ubicacion: string | null
  area_m2: number | null
  num_pisos: number | null
  pais_id: string
  paises: Pais | null
  created_at: string | null
  partidas: PartidaProyecto[]
}

interface BimImport {
  id: string
  archivo_nombre: string
  total_elementos: number
  elementos_mapeados: number | null
  estado: string
  created_at: string
}

interface BimMapeo {
  id: string
  partida_id: string
  formula: string | null
  metrado_calculado: number | null
  partidas: { id: string; nombre: string; unidad: string; capitulo: string | null } | null
}

interface BimElement {
  id: string
  revit_id: string
  familia: string
  tipo: string
  parametros: Record<string, number>
  metadata: Record<string, string> | null
  notas_ia: Record<string, string> | null
  nota_familia: string | null
  metrado_calculado: number | null
  estado: string
  partida_id: string | null
  revit_categorias: { id: string; nombre: string; nombre_es: string } | null
  partidas: { id: string; nombre: string; unidad: string; capitulo: string | null } | null
  mapeos: BimMapeo[]
}

// A group = elements with same categoria + familia + tipo
interface BimGroup {
  key: string
  categoria: string
  categoriaEs: string
  categoriaId: string | null
  familia: string
  tipo: string
  elements: BimElement[]
  sampleParams: Record<string, number>
  sampleMetadata: Record<string, string>
  notasIA: Record<string, string>
  notaFamilia: string | null
  estado: string // dominant estado in the group
  partida: { id: string; nombre: string; unidad: string } | null // legacy compat
  partidas: Array<{ id: string; nombre: string; unidad: string; formula: string | null; metradoTotal: number }> // all mapped partidas
  metradoTotal: number
  suggestions: SuggestedMapeo[] // suggested formulas from revit_mapeos
}

interface SuggestedMapeo {
  id: string
  revit_categoria_id: string
  formula: string
  parametro_principal: string | null
  descripcion: string | null
  condicion_filtro: string | null
  partida_id: string
  partidas: { id: string; nombre: string; unidad: string; capitulo: string | null } | null
}

interface BimData {
  imports: BimImport[]
  elements: BimElement[]
  count: number
  active_import_id?: string
  suggested_mapeos?: SuggestedMapeo[]
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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingPartida, setEditingPartida] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingPartida, setSavingPartida] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [changingEstado, setChangingEstado] = useState(false)
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ nombre: '', unidad: 'm2', capitulo: '' })
  const [addingSaving, setAddingSaving] = useState(false)
  const [plantillaLoading, setPlantillaLoading] = useState(false)
  const [plantillaPreview, setPlantillaPreview] = useState<{ nuevas: number; ya_en_proyecto: number } | null>(null)
  const [plantillaError, setPlantillaError] = useState<string | null>(null)

  // BIM state
  const [bimData, setBimData] = useState<BimData | null>(null)
  const [bimLoading, setBimLoading] = useState(false)
  const [bimOpen, setBimOpen] = useState(false)
  const [bimSearch, setBimSearch] = useState('')
  const [activeImportId, setActiveImportId] = useState<string | null>(null)
  const [deletingImport, setDeletingImport] = useState<string | null>(null)

  // Group expand state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Partida → BIM linking state
  const [linkModalPartida, setLinkModalPartida] = useState<string | null>(null)


  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al cargar el proyecto')
      }
      const data = await res.json()
      setProyecto(data as ProyectoDetail)
    } catch (err) {
      console.error('Error fetching proyecto:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar el proyecto')
    } finally {
      setIsLoading(false)
    }
  }, [proyectoId])

  const fetchBimData = useCallback(async (importId?: string) => {
    setBimLoading(true)
    try {
      const url = importId
        ? `/api/proyectos/${proyectoId}/bim?import_id=${importId}`
        : `/api/proyectos/${proyectoId}/bim`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Error loading BIM data')
      const data = await res.json()
      setBimData(data as BimData)
      setActiveImportId(data.active_import_id || null)
      if (data.imports?.length > 0) setBimOpen(true)
    } catch (err) {
      console.error('BIM fetch error:', err)
    } finally {
      setBimLoading(false)
    }
  }, [proyectoId])

  const handleDeleteImport = async (importId: string) => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/bim?import_id=${importId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error deleting import')
      setDeletingImport(null)
      // Reload — if we deleted the active one, it'll fall back to the next
      await fetchBimData()
    } catch (err) {
      console.error('Delete import error:', err)
    }
  }

  const handleSwitchImport = (importId: string) => {
    setActiveImportId(importId)
    setExpandedGroups(new Set())
    fetchBimData(importId)
  }



  // --- Partida → BIM linking (via modal) ---
  const handleBimModalSaved = async () => {
    setLinkModalPartida(null)
    if (activeImportId) await fetchBimData(activeImportId)
    await fetchData()
  }

  // Get BIM groups linked to a specific partida
  const getLinkedGroups = (partidaId: string): BimGroup[] => {
    return bimGroups.filter(g =>
      g.partidas.some(p => p.id === partidaId)
    )
  }

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Build BIM groups from elements
  const bimGroups = useMemo((): BimGroup[] => {
    if (!bimData?.elements) return []
    const sugMapeos = bimData.suggested_mapeos || []
    const map = new Map<string, BimElement[]>()
    for (const el of bimData.elements) {
      const key = `${el.revit_categorias?.nombre || 'Unknown'}::${el.familia}::${el.tipo}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(el)
    }
    return Array.from(map.entries()).map(([key, elements]) => {
      const first = elements[0]
      // Merge all numeric params
      const allParams: Record<string, number> = {}
      const allMeta: Record<string, string> = {}
      const allNotasIA: Record<string, string> = {}
      let notaFam: string | null = null
      for (const el of elements) {
        if (el.parametros) {
          for (const [k, v] of Object.entries(el.parametros)) {
            if (typeof v === 'number' && !(k in allParams)) allParams[k] = v
          }
        }
        if (el.metadata) {
          for (const [k, v] of Object.entries(el.metadata)) {
            if (!(k in allMeta)) allMeta[k] = v
          }
        }
        if (el.notas_ia) {
          for (const [k, v] of Object.entries(el.notas_ia)) {
            if (!(k in allNotasIA)) allNotasIA[k] = v
          }
        }
        if (el.nota_familia && !notaFam) notaFam = el.nota_familia
      }
      // Dominant estado
      const estados = elements.map(e => e.estado)
      let dominantEstado = 'pendiente'
      if (estados.every(e => e === 'confirmado')) dominantEstado = 'confirmado'
      else if (estados.every(e => e === 'mapeado')) dominantEstado = 'mapeado'
      else if (estados.some(e => e === 'mapeado')) dominantEstado = 'mapeado'
      else if (estados.some(e => e === 'sin_match')) dominantEstado = 'sin_match'

      const metradoTotal = elements.reduce((s, e) => s + (e.metrado_calculado || 0), 0)

      // Suggestions from revit_mapeos matching this category
      const catId = first.revit_categorias?.id
      const suggestions = catId ? sugMapeos.filter(m => m.revit_categoria_id === catId) : []

      // Collect all unique partida mappings from junction table mapeos
      const partidaMap = new Map<string, { id: string; nombre: string; unidad: string; formula: string | null; metradoTotal: number }>()
      for (const el of elements) {
        for (const m of el.mapeos || []) {
          if (!m.partidas) continue
          const existing = partidaMap.get(m.partida_id)
          if (existing) {
            existing.metradoTotal += m.metrado_calculado || 0
          } else {
            partidaMap.set(m.partida_id, {
              id: m.partidas.id,
              nombre: m.partidas.nombre,
              unidad: m.partidas.unidad,
              formula: m.formula,
              metradoTotal: m.metrado_calculado || 0,
            })
          }
        }
      }

      return {
        key,
        categoria: first.revit_categorias?.nombre || 'Unknown',
        categoriaEs: first.revit_categorias?.nombre_es || first.revit_categorias?.nombre || 'Desconocido',
        categoriaId: first.revit_categorias?.id || null,
        familia: first.familia,
        tipo: first.tipo,
        elements,
        sampleParams: allParams,
        sampleMetadata: allMeta,
        notasIA: allNotasIA,
        notaFamilia: notaFam,
        estado: dominantEstado,
        partida: first.partidas ? { id: first.partidas.id, nombre: first.partidas.nombre, unidad: first.partidas.unidad } : null,
        partidas: Array.from(partidaMap.values()),
        metradoTotal,
        suggestions,
      }
    })
  }, [bimData?.elements, bimData?.suggested_mapeos])

  // Filter groups by search
  const filteredGroups = useMemo(() => {
    if (!bimSearch) return bimGroups
    const s = bimSearch.toLowerCase()
    return bimGroups.filter(g =>
      g.familia.toLowerCase().includes(s) ||
      g.tipo.toLowerCase().includes(s) ||
      g.categoriaEs.toLowerCase().includes(s) ||
      g.partida?.nombre?.toLowerCase().includes(s)
    )
  }, [bimGroups, bimSearch])

  useEffect(() => {
    if (proyectoId) {
      fetchData()
      fetchBimData()
    }
  }, [proyectoId, fetchData, fetchBimData])

  const handleUpdateMetrado = async (ppId: string) => {
    const value = parseFloat(editValue)
    if (isNaN(value) || value < 0) return

    setSavingPartida(ppId)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/partidas`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyecto_partida_id: ppId,
          metrado_manual: value,
          metrado_final: value,
        }),
      })
      if (!res.ok) throw new Error('Error al actualizar')
      setEditingPartida(null)
      await fetchData()
    } catch (err) {
      console.error(err)
    } finally {
      setSavingPartida(null)
    }
  }

  const handleRemovePartida = async (ppId: string) => {
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/partidas`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyecto_partida_id: ppId }),
      })
      if (!res.ok) throw new Error('Error al eliminar')
      setDeleteConfirm(null)
      await fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const handleEstadoChange = async (newEstado: string) => {
    setChangingEstado(true)
    try {
      const res = await fetch('/api/proyectos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: proyectoId, estado: newEstado }),
      })
      if (!res.ok) throw new Error('Error al cambiar estado')
      await fetchData()
    } catch (err) {
      console.error(err)
    } finally {
      setChangingEstado(false)
    }
  }

  const toggleChapter = (chapter: string) => {
    setCollapsedChapters(prev => {
      const next = new Set(prev)
      if (next.has(chapter)) next.delete(chapter)
      else next.add(chapter)
      return next
    })
  }

  const formatDate = (date: string | null) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('es-BO', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const getMetrado = (p: PartidaProyecto) => {
    return p.metrado_final ?? p.metrado_manual ?? p.metrado_bim ?? 0
  }

  const handleExport = (format: 'excel' | 'json') => {
    window.open(`/api/proyectos/${proyectoId}/export?format=${format}`, '_blank')
  }

  const handleAddPartida = async () => {
    if (!addForm.nombre.trim() || !addForm.unidad) return
    setAddingSaving(true)
    try {
      const res = await fetch('/api/partidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: addForm.nombre.trim(),
          unidad: addForm.unidad,
          capitulo: addForm.capitulo || undefined,
          proyecto_id: proyectoId,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear')
      }
      setAddForm({ nombre: '', unidad: 'm2', capitulo: '' })
      setShowAddForm(false)
      await fetchData()
    } catch (err) {
      console.error(err)
    } finally {
      setAddingSaving(false)
    }
  }

  const handlePlantillaPreview = async () => {
    setPlantillaError(null)
    setPlantillaLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/plantilla`)
      const data = await res.json()
      if (!res.ok) {
        setPlantillaError(data.error || 'Error al consultar plantilla')
        return
      }
      setPlantillaPreview(data)
    } catch {
      setPlantillaError('Error de conexión')
    } finally {
      setPlantillaLoading(false)
    }
  }

  const handlePlantillaLoad = async () => {
    setPlantillaLoading(true)
    setPlantillaError(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/plantilla`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setPlantillaError(data.error || 'Error al cargar plantilla')
        return
      }
      setPlantillaPreview(null)
      await fetchData()
    } catch {
      setPlantillaError('Error de conexión')
    } finally {
      setPlantillaLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
  const partidas = proyecto.partidas || []

  // Group partidas by capitulo
  const grouped: Record<string, PartidaProyecto[]> = {}
  partidas.forEach(p => {
    const chapter = p.partidas?.capitulo || 'Sin capítulo'
    if (!grouped[chapter]) grouped[chapter] = []
    grouped[chapter].push(p)
  })

  const totalMetrado = partidas.reduce((sum, p) => sum + getMetrado(p), 0)

  return (
    <div className="p-8 space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push('/dashboard/proyectos')} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Volver a proyectos
      </Button>

      {/* Project header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold">{proyecto.nombre}</h1>
          {/* Estado selector */}
          <select
            value={proyecto.estado || 'activo'}
            onChange={e => handleEstadoChange(e.target.value)}
            disabled={changingEstado}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer ${estado.color}`}
          >
            {Object.entries(ESTADOS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
        {proyecto.descripcion && (
          <p className="text-muted-foreground">{proyecto.descripcion}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {proyecto.paises && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {proyecto.paises.nombre}
              {proyecto.ubicacion ? ` · ${proyecto.ubicacion}` : ''}
            </span>
          )}
          {proyecto.tipologia && (
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {proyecto.tipologia}
            </span>
          )}
          {proyecto.area_m2 && (
            <span>{proyecto.area_m2} m2</span>
          )}
          {proyecto.num_pisos && (
            <span>{proyecto.num_pisos} pisos</span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {formatDate(proyecto.created_at)}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Link href={`/dashboard/catalogo?proyecto=${proyectoId}`}>
          <Card className="hover:border-primary/40 transition-all cursor-pointer h-full">
            <CardContent className="py-5 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-100">
                <Plus className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Agregar partidas</h3>
                <p className="text-xs text-muted-foreground">Desde catalogo</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card
          className="hover:border-primary/40 transition-all cursor-pointer h-full"
          onClick={() => {
            setBimOpen(true)
            setTimeout(() => document.getElementById('bim-section')?.scrollIntoView({ behavior: 'smooth' }), 100)
          }}
        >
          <CardContent className="py-5 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-100">
              <Link2 className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Vincular BIM</h3>
              <p className="text-xs text-muted-foreground">
                {bimData && bimData.imports.length > 0
                  ? `${bimData.elements?.length || 0} elementos`
                  : 'Sin importaciones'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Link href="/dashboard/agentes">
          <Card className="hover:border-primary/40 transition-all cursor-pointer h-full">
            <CardContent className="py-5 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-violet-100">
                <Bot className="w-5 h-5 text-violet-700" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Agentes IA</h3>
                <p className="text-xs text-muted-foreground">Normativa, metrados</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {proyecto.tipologia && proyecto.tipologia !== 'Otro' ? (
          <Card
            className="hover:border-primary/40 transition-all cursor-pointer h-full"
            onClick={plantillaLoading ? undefined : handlePlantillaPreview}
          >
            <CardContent className="py-5 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-orange-100">
                {plantillaLoading ? (
                  <Loader2 className="w-5 h-5 text-orange-700 animate-spin" />
                ) : (
                  <LayoutTemplate className="w-5 h-5 text-orange-700" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-sm">Plantilla</h3>
                <p className="text-xs text-muted-foreground">{proyecto.tipologia}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="hover:border-primary/40 transition-all cursor-pointer h-full">
            <CardContent className="py-5 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-100">
                <Upload className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Importar BIM</h3>
                <p className="text-xs text-muted-foreground">Revit 2025</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="h-full">
          <CardContent className="py-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-100">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Exportar planilla</h3>
                <p className="text-xs text-muted-foreground">{partidas.length} partidas</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                onClick={() => handleExport('excel')}
                disabled={partidas.length === 0}
              >
                <Download className="w-3.5 h-3.5" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                onClick={() => handleExport('json')}
                disabled={partidas.length === 0}
              >
                <Download className="w-3.5 h-3.5" />
                JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plantilla preview */}
      {(plantillaPreview || plantillaError) && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="py-4">
            {plantillaError ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-destructive">{plantillaError}</p>
                <Button variant="ghost" size="sm" onClick={() => { setPlantillaError(null); setPlantillaPreview(null) }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : plantillaPreview && plantillaPreview.nuevas > 0 ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LayoutTemplate className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium">
                      Plantilla &ldquo;{proyecto.tipologia}&rdquo;: {plantillaPreview.nuevas} partidas nuevas disponibles
                    </p>
                    {plantillaPreview.ya_en_proyecto > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {plantillaPreview.ya_en_proyecto} ya están en el proyecto
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setPlantillaPreview(null); setPlantillaError(null) }}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handlePlantillaLoad} disabled={plantillaLoading} className="gap-1.5">
                    {plantillaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Cargar {plantillaPreview.nuevas} partidas
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Todas las partidas de la plantilla ya están en el proyecto.
                </p>
                <Button variant="ghost" size="sm" onClick={() => setPlantillaPreview(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BIM Section — read-only view of imported data from Revit */}
      <div id="bim-section" />
      {bimData && bimData.imports.length > 0 && (() => {
        const elements = bimData.elements || []
        const vinculados = bimGroups.filter(g => g.partida !== null).length
        const sinVincular = bimGroups.filter(g => g.partida === null).length
        const activeImport = bimData.imports.find(i => i.id === activeImportId) || bimData.imports[0]

        return (
          <Card>
            <CardHeader className="pb-3">
              <button
                onClick={() => setBimOpen(!bimOpen)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-3">
                  {bimOpen
                    ? <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                  <Box className="w-5 h-5 text-indigo-600" />
                  <div>
                    <CardTitle className="text-base">Elementos BIM</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {elements.length} elementos en {bimGroups.length} grupos · Vincular desde partidas abajo
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {vinculados > 0 && (
                    <Badge variant="outline" className="text-green-600 bg-green-50 text-[10px]">
                      {vinculados} vinculados
                    </Badge>
                  )}
                  {sinVincular > 0 && (
                    <Badge variant="outline" className="text-amber-600 bg-amber-50 text-[10px]">
                      {sinVincular} sin vincular
                    </Badge>
                  )}
                </div>
              </button>
            </CardHeader>

            {bimOpen && (
              <CardContent className="space-y-3">
                {/* Import selector (when multiple) */}
                {bimData.imports.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap pb-1 border-b">
                    <span className="text-[11px] font-medium text-muted-foreground">Importaciones:</span>
                    {bimData.imports.map(imp => (
                      <div key={imp.id} className="flex items-center gap-1">
                        <button
                          onClick={() => handleSwitchImport(imp.id)}
                          className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                            imp.id === activeImportId
                              ? 'bg-indigo-100 text-indigo-800 font-medium'
                              : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {imp.archivo_nombre || 'Sin nombre'} ({imp.total_elementos})
                          <span className="ml-1 text-[10px] opacity-60">
                            {new Date(imp.created_at).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
                          </span>
                        </button>
                        {deletingImport === imp.id ? (
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleDeleteImport(imp.id)}>
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setDeletingImport(null)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 hover:opacity-100 text-destructive"
                            onClick={() => setDeletingImport(imp.id)}
                            title="Eliminar importación"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Active import info */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{activeImport.archivo_nombre}</span>
                  <span>{elements.length} elementos</span>
                  <span>{new Date(activeImport.created_at).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {bimData.imports.length === 1 && (
                    <>
                      <span className="ml-auto" />
                      {deletingImport === activeImport.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-destructive text-[11px]">Eliminar?</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleDeleteImport(activeImport.id)}>
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setDeletingImport(null)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 text-[10px] text-destructive hover:text-destructive"
                          onClick={() => setDeletingImport(activeImport.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                          Eliminar
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {/* Search + Refresh */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar familia, tipo..."
                      value={bimSearch}
                      onChange={e => setBimSearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => fetchBimData(activeImportId || undefined)}
                    disabled={bimLoading}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${bimLoading ? 'animate-spin' : ''}`} />
                    Actualizar
                  </Button>
                  <p className="text-[11px] text-muted-foreground ml-auto">
                    Para vincular, usa el boton <Link2 className="w-3 h-3 inline" /> en cada partida abajo
                  </p>
                </div>

                {/* BIM Groups list — read-only, linking is done from partidas */}
                <div className="space-y-1.5">
                  {filteredGroups.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {bimSearch ? 'No se encontraron grupos' : 'No hay elementos en esta importación'}
                    </div>
                  ) : (
                    filteredGroups.map(group => {
                      const isExpanded = expandedGroups.has(group.key)
                      const isLinked = group.partida !== null
                      const paramKeys = Object.keys(group.sampleParams).filter(k =>
                        typeof group.sampleParams[k] === 'number' && group.sampleParams[k] > 0
                      )

                      return (
                        <div key={group.key} className="border rounded-lg overflow-hidden">
                          {/* Group header */}
                          <div
                            onClick={() => toggleGroup(group.key)}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                              isLinked ? 'bg-green-50/50 hover:bg-green-50' : 'bg-muted/30 hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{group.categoriaEs}</span>
                                <span className="text-xs text-muted-foreground">/</span>
                                <span className="text-sm font-medium truncate">{group.familia}</span>
                                <span className="text-xs text-muted-foreground">/</span>
                                <span className="text-sm truncate">{group.tipo}</span>
                              </div>
                              {isLinked && (
                                <p className="text-xs text-green-700 mt-0.5">Vinculado a: {group.partida!.nombre}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant="outline" className="text-[10px]">
                                <Layers className="w-3 h-3 mr-1" />
                                {group.elements.length}
                              </Badge>
                              {/* Show key params inline */}
                              {paramKeys.slice(0, 3).map(k => (
                                <span key={k} className="text-[10px] font-mono text-indigo-600">
                                  {k}={group.sampleParams[k] % 1 === 0 ? group.sampleParams[k] : group.sampleParams[k].toFixed(1)}
                                </span>
                              ))}
                              {paramKeys.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{paramKeys.length - 3}</span>
                              )}
                              {isLinked ? (
                                <Badge variant="outline" className="text-green-600 bg-green-50 text-[10px]">Vinculado</Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 bg-amber-50 text-[10px]">Sin vincular</Badge>
                              )}
                            </div>
                          </div>

                          {/* Expanded: show params + elements */}
                          {isExpanded && (
                            <div className="border-t">
                              <div className="bg-muted/20 px-3 py-2 space-y-2">
                                {/* Numeric parameters */}
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Parametros ({paramKeys.length})</p>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(group.sampleParams)
                                      .filter(([, v]) => v > 0)
                                      .sort(([a], [b]) => a.localeCompare(b))
                                      .map(([k, v]) => (
                                        <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background border text-[10px]">
                                          <span className="font-mono font-medium text-indigo-700">{k}</span>
                                          <span className="text-muted-foreground">= {v % 1 === 0 ? v : v.toFixed(2)}</span>
                                        </span>
                                      ))}
                                  </div>
                                </div>
                                {/* Metadata */}
                                {Object.keys(group.sampleMetadata).length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Metadata</p>
                                    <div className="flex flex-wrap gap-1">
                                      {Object.entries(group.sampleMetadata)
                                        .filter(([, v]) => v && v.length > 0)
                                        .map(([k, v]) => (
                                          <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 border text-[10px]">
                                            <span className="font-medium text-slate-600">{k}</span>
                                            <span className="text-muted-foreground truncate max-w-[150px]">{v}</span>
                                          </span>
                                        ))}
                                    </div>
                                  </div>
                                )}
                                {/* AI Notes */}
                                {group.notaFamilia && (
                                  <p className="text-[10px] text-violet-600 italic">IA: {group.notaFamilia}</p>
                                )}
                              </div>

                              {/* Elements list */}
                              <div className="max-h-[200px] overflow-y-auto divide-y">
                                {group.elements.map(el => (
                                  <div key={el.id} className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-muted/20">
                                    <span className="font-mono text-muted-foreground truncate w-24">{el.revit_id}</span>
                                    {el.metadata?.nivel && (
                                      <span className="text-[10px] text-muted-foreground">Nivel: {el.metadata.nivel}</span>
                                    )}
                                    <span className="ml-auto font-mono">
                                      {el.metrado_calculado != null ? el.metrado_calculado.toFixed(2) : '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })()}

      {/* Partidas Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Partidas del proyecto</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {partidas.length} partida{partidas.length !== 1 ? 's' : ''} · Metrado total: {totalMetrado.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddForm(!showAddForm)}>
                <Pencil className="w-3.5 h-3.5" />
                Manual
              </Button>
              <Link href={`/dashboard/catalogo?proyecto=${proyectoId}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Catalogo
                </Button>
              </Link>
            </div>
          </div>

          {/* Manual add form */}
          {showAddForm && (
            <div className="mt-3 p-4 border rounded-lg bg-muted/30 space-y-3">
              <p className="text-sm font-medium">Agregar partida manual</p>
              <div className="grid grid-cols-[1fr_100px_1fr] gap-3">
                <Input
                  placeholder="Nombre de la partida"
                  value={addForm.nombre}
                  onChange={e => setAddForm({ ...addForm, nombre: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddPartida() }}
                  className="h-9 text-sm"
                />
                <select
                  value={addForm.unidad}
                  onChange={e => setAddForm({ ...addForm, unidad: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {['m2', 'm3', 'ml', 'kg', 'pza', 'glb', 'm', 'und', 'lt', 'pto'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <Input
                  placeholder="Capitulo (opcional)"
                  value={addForm.capitulo}
                  onChange={e => setAddForm({ ...addForm, capitulo: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddPartida} disabled={addingSaving || !addForm.nombre.trim()}>
                  {addingSaving ? 'Guardando...' : 'Agregar al proyecto'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancelar</Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                La partida se crea en el catalogo master y se agrega a este proyecto automaticamente.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {partidas.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <LayoutTemplate className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">No hay partidas asignadas</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {proyecto.tipologia && proyecto.tipologia !== 'Otro'
                    ? `Carga la plantilla predefinida para "${proyecto.tipologia}" o agrega partidas manualmente.`
                    : 'Agrega partidas desde el catálogo, importa desde Revit o consulta los agentes IA para sugerencias.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                {proyecto.tipologia && proyecto.tipologia !== 'Otro' && (
                  <Button
                    className="gap-2"
                    onClick={handlePlantillaPreview}
                    disabled={plantillaLoading}
                  >
                    {plantillaLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LayoutTemplate className="w-4 h-4" />
                    )}
                    Cargar plantilla
                  </Button>
                )}
                <Link href={`/dashboard/catalogo?proyecto=${proyectoId}`}>
                  <Button variant={proyecto.tipologia && proyecto.tipologia !== 'Otro' ? 'outline' : 'default'} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Agregar desde catálogo
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table header */}
              <div className="grid grid-cols-[60px_1fr_100px_80px_60px_36px_40px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b">
                <span>Codigo</span>
                <span>Partida</span>
                <span className="text-right">Metrado</span>
                <span className="text-center">Unidad</span>
                <span className="text-center">Origen</span>
                <span className="text-center">{bimData && bimData.imports.length > 0 ? 'BIM' : ''}</span>
                <span></span>
              </div>

              {Object.entries(grouped).map(([chapter, items]) => (
                <div key={chapter}>
                  {/* Chapter header */}
                  <button
                    onClick={() => toggleChapter(chapter)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    {collapsedChapters.has(chapter)
                      ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                    <span className="text-sm font-semibold">{chapter}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {items.length}
                    </Badge>
                  </button>

                  {/* Chapter items */}
                  {!collapsedChapters.has(chapter) && (
                    <div className="space-y-0.5 mt-0.5">
                      {items.map(p => {
                        const metrado = getMetrado(p)
                        const isEditing = editingPartida === p.id
                        const isSaving = savingPartida === p.id
                        const isDeleting = deleteConfirm === p.id
                        const origen = p.metrado_bim != null ? 'BIM' : p.metrado_manual != null ? 'Manual' : '—'
                        const codigoLocal = p.partidas?.partida_localizaciones?.[0]?.codigo_local || ''
                        const hasBimData = bimData && bimData.imports.length > 0
                        const linkedGroups = hasBimData ? getLinkedGroups(p.partida_id) : []

                        return (
                          <div key={p.id}>
                            <div className="group grid grid-cols-[60px_1fr_100px_80px_60px_36px_40px] gap-2 items-center px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                              {/* Codigo */}
                              <span className="text-xs font-mono font-bold text-blue-600">
                                {codigoLocal || '—'}
                              </span>

                              {/* Name */}
                              <div className="min-w-0">
                                <p className="text-sm truncate">
                                  {p.partidas?.nombre || `Partida ${p.partida_id.slice(0, 8)}`}
                                </p>
                                {p.notas && (
                                  <p className="text-[11px] text-muted-foreground truncate">{p.notas}</p>
                                )}
                                {linkedGroups.length > 0 && (
                                  <p className="text-[10px] text-indigo-600 truncate">
                                    {linkedGroups.map(g => {
                                      const mapeo = g.partidas.find(pp => pp.id === p.partida_id)
                                      return `${g.familia}/${g.tipo}${mapeo?.formula ? ` [${mapeo.formula}]` : ''}`
                                    }).join(', ')}
                                  </p>
                                )}
                              </div>

                              {/* Metrado */}
                              <div className="text-right">
                                {isEditing ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={editValue}
                                      onChange={e => setEditValue(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleUpdateMetrado(p.id)
                                        if (e.key === 'Escape') setEditingPartida(null)
                                      }}
                                      className="h-7 w-20 text-xs text-right"
                                      autoFocus
                                      disabled={isSaving}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleUpdateMetrado(p.id)}
                                      disabled={isSaving}
                                    >
                                      <Check className="w-3 h-3 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => setEditingPartida(null)}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingPartida(p.id)
                                      setEditValue(metrado.toString())
                                    }}
                                    className="text-sm font-medium hover:text-primary transition-colors inline-flex items-center gap-1"
                                    title="Editar metrado"
                                  >
                                    {metrado > 0 ? metrado.toFixed(2) : '—'}
                                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                                  </button>
                                )}
                              </div>

                              {/* Unidad */}
                              <span className="text-xs text-center text-muted-foreground">
                                {p.partidas?.unidad || '—'}
                              </span>

                              {/* Origen */}
                              <span className="text-center">
                                {origen !== '—' ? (
                                  <Badge variant="outline" className="text-[10px]">{origen}</Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </span>

                              {/* BIM Link */}
                              <div className="flex justify-center">
                                {hasBimData ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-6 w-6 ${linkedGroups.length > 0
                                      ? 'text-indigo-600 hover:text-indigo-800'
                                      : 'opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-indigo-600'
                                    }`}
                                    onClick={() => setLinkModalPartida(p.partida_id)}
                                    title={linkedGroups.length > 0 ? `${linkedGroups.length} grupo(s) vinculado(s) — editar` : 'Vincular con BIM'}
                                  >
                                    {linkedGroups.length > 0 ? <Pencil className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                                  </Button>
                                ) : null}
                              </div>

                              {/* Actions */}
                              <div className="flex justify-end">
                                {isDeleting ? (
                                  <div className="flex items-center gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleRemovePartida(p.id)}
                                    >
                                      <Check className="w-3 h-3 text-destructive" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => setDeleteConfirm(null)}
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                    onClick={() => setDeleteConfirm(p.id)}
                                    title="Quitar del proyecto"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* BIM Link Modal */}
      {linkModalPartida && activeImportId && (() => {
        const pp = partidas.find(p => p.partida_id === linkModalPartida)
        return pp ? (
          <BimLinkModal
            open={true}
            onClose={() => setLinkModalPartida(null)}
            partidaId={linkModalPartida}
            partidaNombre={pp.partidas?.nombre || 'Partida'}
            partidaUnidad={pp.partidas?.unidad || '—'}
            bimGroups={bimGroups}
            activeImportId={activeImportId}
            proyectoId={proyectoId}
            onSaved={handleBimModalSaved}
          />
        ) : null
      })()}
    </div>
  )
}
