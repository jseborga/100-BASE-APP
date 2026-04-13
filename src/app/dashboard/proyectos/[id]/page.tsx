'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, MapPin, Building2, Calendar, Bot, FileSpreadsheet,
  Upload, Trash2, Check, X, Pencil, Plus, ChevronDown, ChevronRight, Download,
  LayoutTemplate, Loader2, Box, RefreshCw, CheckCircle2, AlertCircle, Clock,
  Search, GitBranch, Calculator, Layers, Save,
} from 'lucide-react'
import Link from 'next/link'

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
  estado: string
  created_at: string
}

interface BimElement {
  id: string
  revit_id: string
  familia: string
  tipo: string
  parametros: Record<string, number>
  metrado_calculado: number | null
  estado: string
  formula_usada: string | null
  notas_mapeo: string | null
  partida_codigo: string | null
  partida_nombre: string | null
  revit_categorias: { id: string; nombre: string; nombre_es: string } | null
  partidas: { id: string; nombre: string; unidad: string; capitulo: string | null } | null
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
  estado: string // dominant estado in the group
  partida: { id: string; nombre: string; unidad: string } | null
  formula: string | null
  metradoTotal: number
}

interface BimData {
  imports: BimImport[]
  elements: BimElement[]
  count: number
  latest_import_id?: string
}

const ESTADO_BIM: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pendiente: { label: 'Pendiente', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  mapeado: { label: 'Mapeado', icon: CheckCircle2, color: 'text-blue-600 bg-blue-50' },
  confirmado: { label: 'Confirmado', icon: Check, color: 'text-green-600 bg-green-50' },
  sin_match: { label: 'Sin match', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
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
  const [bimConfirming, setBimConfirming] = useState(false)
  const [bimFilter, setBimFilter] = useState<string>('all')
  const [bimSearch, setBimSearch] = useState('')
  const [editingBimElement, setEditingBimElement] = useState<string | null>(null)
  const [editBimMetrado, setEditBimMetrado] = useState('')

  // Group mapping state
  const [mappingGroup, setMappingGroup] = useState<string | null>(null) // group key being mapped
  const [mapFormula, setMapFormula] = useState('')
  const [mapPartidaSearch, setMapPartidaSearch] = useState('')
  const [mapPartidaResults, setMapPartidaResults] = useState<{id:string;nombre:string;unidad:string;capitulo:string|null}[]>([])
  const [mapSelectedPartida, setMapSelectedPartida] = useState<{id:string;nombre:string;unidad:string}|null>(null)
  const [mapSearching, setMapSearching] = useState(false)
  const [mapSaving, setMapSaving] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const mapFormRef = useRef<HTMLDivElement>(null)

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

  const fetchBimData = useCallback(async () => {
    setBimLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/bim`)
      if (!res.ok) throw new Error('Error loading BIM data')
      const data = await res.json()
      setBimData(data as BimData)
      if (data.imports?.length > 0) setBimOpen(true)
    } catch (err) {
      console.error('BIM fetch error:', err)
    } finally {
      setBimLoading(false)
    }
  }, [proyectoId])

  const handleBimConfirm = async (elementIds?: string[]) => {
    if (!bimData?.latest_import_id) return
    setBimConfirming(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/bim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importacion_id: bimData.latest_import_id,
          elemento_ids: elementIds,
        }),
      })
      if (!res.ok) throw new Error('Error confirming BIM match')
      await Promise.all([fetchData(), fetchBimData()])
    } catch (err) {
      console.error('BIM confirm error:', err)
    } finally {
      setBimConfirming(false)
    }
  }

  const handleBimUpdateMetrado = async (elementId: string) => {
    const value = parseFloat(editBimMetrado)
    if (isNaN(value) || value < 0) return
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/bim`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elemento_id: elementId, metrado_override: value }),
      })
      if (!res.ok) throw new Error('Error updating metrado')
      setEditingBimElement(null)
      await fetchBimData()
    } catch (err) {
      console.error('BIM update error:', err)
    }
  }

  // Partida search for group mapping
  useEffect(() => {
    if (mapPartidaSearch.length < 2) { setMapPartidaResults([]); return }
    const t = setTimeout(async () => {
      setMapSearching(true)
      try {
        const res = await fetch('/api/mapeos/partidas?q=' + encodeURIComponent(mapPartidaSearch))
        if (res.ok) { const d = await res.json(); setMapPartidaResults(d.partidas || []) }
      } catch { /* */ }
      finally { setMapSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [mapPartidaSearch])

  // Scroll to mapping form
  useEffect(() => {
    if (mappingGroup && mapFormRef.current) {
      setTimeout(() => mapFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    }
  }, [mappingGroup])

  const handleGroupMap = async (group: BimGroup) => {
    if (!mapSelectedPartida || !mapFormula.trim() || !bimData?.latest_import_id) return
    setMapSaving(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/bim`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importacion_id: bimData.latest_import_id,
          revit_categoria_id: group.categoriaId,
          familia: group.familia,
          tipo: group.tipo,
          partida_id: mapSelectedPartida.id,
          formula: mapFormula,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Error mapping group')
      }
      // Reset form and reload
      setMappingGroup(null)
      setMapFormula('')
      setMapSelectedPartida(null)
      setMapPartidaSearch('')
      await fetchBimData()
    } catch (err) {
      console.error('Group map error:', err)
    } finally {
      setMapSaving(false)
    }
  }

  const startMapping = (groupKey: string, group: BimGroup) => {
    setMappingGroup(groupKey)
    setMapFormula(group.formula || '')
    if (group.partida) {
      setMapSelectedPartida(group.partida)
      setMapPartidaSearch(group.partida.nombre)
    } else {
      setMapSelectedPartida(null)
      setMapPartidaSearch('')
    }
    setMapPartidaResults([])
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
    const map = new Map<string, BimElement[]>()
    for (const el of bimData.elements) {
      const key = `${el.revit_categorias?.nombre || 'Unknown'}::${el.familia}::${el.tipo}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(el)
    }
    return Array.from(map.entries()).map(([key, elements]) => {
      const first = elements[0]
      // Merge all params to show available ones
      const allParams: Record<string, number> = {}
      for (const el of elements) {
        if (el.parametros) {
          for (const [k, v] of Object.entries(el.parametros)) {
            if (typeof v === 'number' && !(k in allParams)) allParams[k] = v
          }
        }
      }
      // Dominant estado
      const estados = elements.map(e => e.estado)
      let dominantEstado = 'pendiente'
      if (estados.every(e => e === 'confirmado')) dominantEstado = 'confirmado'
      else if (estados.every(e => e === 'mapeado')) dominantEstado = 'mapeado'
      else if (estados.some(e => e === 'mapeado')) dominantEstado = 'mapeado'
      else if (estados.some(e => e === 'sin_match')) dominantEstado = 'sin_match'

      const metradoTotal = elements.reduce((s, e) => s + (e.metrado_calculado || 0), 0)

      return {
        key,
        categoria: first.revit_categorias?.nombre || 'Unknown',
        categoriaEs: first.revit_categorias?.nombre_es || first.revit_categorias?.nombre || 'Desconocido',
        categoriaId: first.revit_categorias?.id || null,
        familia: first.familia,
        tipo: first.tipo,
        elements,
        sampleParams: allParams,
        estado: dominantEstado,
        partida: first.partidas ? { id: first.partidas.id, nombre: first.partidas.nombre, unidad: first.partidas.unidad } : null,
        formula: first.formula_usada,
        metradoTotal,
      }
    })
  }, [bimData?.elements])

  // Filter groups
  const filteredGroups = useMemo(() => {
    let groups = bimGroups
    if (bimFilter !== 'all') {
      groups = groups.filter(g => g.estado === bimFilter)
    }
    if (bimSearch) {
      const s = bimSearch.toLowerCase()
      groups = groups.filter(g =>
        g.familia.toLowerCase().includes(s) ||
        g.tipo.toLowerCase().includes(s) ||
        g.categoriaEs.toLowerCase().includes(s) ||
        g.partida?.nombre?.toLowerCase().includes(s)
      )
    }
    return groups
  }, [bimGroups, bimFilter, bimSearch])

  // Test formula with sample params
  const testFormula = (formula: string, params: Record<string, number>): string | null => {
    if (!formula.trim()) return null
    try {
      let expr = formula
      const sortedKeys = Object.keys(params).sort((a, b) => b.length - a.length)
      for (const k of sortedKeys) {
        expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), String(params[k]))
      }
      if (/[^0-9+\-*/().eE\s]/.test(expr)) return 'Error: caracteres no válidos'
      const r = Function(`"use strict"; return (${expr})`)()
      return typeof r === 'number' && isFinite(r) ? `= ${r.toFixed(4)}` : 'Error'
    } catch { return 'Error: fórmula inválida' }
  }

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

        <Link href={`/dashboard/mapeos?proyecto=${proyectoId}`}>
          <Card className="hover:border-primary/40 transition-all cursor-pointer h-full">
            <CardContent className="py-5 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-100">
                <GitBranch className="w-5 h-5 text-indigo-700" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Mapeos BIM</h3>
                <p className="text-xs text-muted-foreground">Reglas + formulas</p>
              </div>
            </CardContent>
          </Card>
        </Link>

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

      {/* BIM Section */}
      {bimData && bimData.imports.length > 0 && (() => {
        const elements = bimData.elements || []
        const mapeados = elements.filter(e => e.estado === 'mapeado').length
        const confirmados = elements.filter(e => e.estado === 'confirmado').length
        const pendientes = elements.filter(e => e.estado === 'pendiente').length
        const sinMatch = elements.filter(e => e.estado === 'sin_match').length
        const latestImport = bimData.imports[0]

        // Group categories for summary
        const categoryCounts = new Map<string, number>()
        for (const g of bimGroups) {
          const c = g.categoriaEs
          categoryCounts.set(c, (categoryCounts.get(c) || 0) + g.elements.length)
        }

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
                    <CardTitle className="text-base">Mapeo BIM</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {latestImport.archivo_nombre} · {elements.length} elementos en {bimGroups.length} grupos · {new Date(latestImport.created_at).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {confirmados > 0 && (
                    <Badge variant="outline" className="text-green-600 bg-green-50 text-[10px]">
                      {confirmados} confirmados
                    </Badge>
                  )}
                  {mapeados > 0 && (
                    <Badge variant="outline" className="text-blue-600 bg-blue-50 text-[10px]">
                      {mapeados} mapeados
                    </Badge>
                  )}
                  {pendientes > 0 && (
                    <Badge variant="outline" className="text-amber-600 bg-amber-50 text-[10px]">
                      {pendientes} pendientes
                    </Badge>
                  )}
                  {sinMatch > 0 && (
                    <Badge variant="outline" className="text-red-600 bg-red-50 text-[10px]">
                      {sinMatch} sin match
                    </Badge>
                  )}
                </div>
              </button>
            </CardHeader>

            {bimOpen && (
              <CardContent className="space-y-3">
                {/* Filter tabs + Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
                    {[
                      { key: 'all', label: 'Todos', count: bimGroups.length },
                      { key: 'pendiente', label: 'Pendientes', count: bimGroups.filter(g => g.estado === 'pendiente').length },
                      { key: 'mapeado', label: 'Mapeados', count: bimGroups.filter(g => g.estado === 'mapeado').length },
                      { key: 'confirmado', label: 'Confirmados', count: bimGroups.filter(g => g.estado === 'confirmado').length },
                      { key: 'sin_match', label: 'Sin match', count: bimGroups.filter(g => g.estado === 'sin_match').length },
                    ].filter(t => t.key === 'all' || t.count > 0).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setBimFilter(tab.key)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          bimFilter === tab.key
                            ? 'bg-background shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>

                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar familia, tipo, partida..."
                      value={bimSearch}
                      onChange={e => setBimSearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => fetchBimData()}
                      disabled={bimLoading}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${bimLoading ? 'animate-spin' : ''}`} />
                      Actualizar
                    </Button>
                    {mapeados > 0 && (
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => handleBimConfirm()}
                        disabled={bimConfirming}
                      >
                        {bimConfirming ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Confirmar {mapeados} mapeados
                      </Button>
                    )}
                  </div>
                </div>

                {/* Grouped elements */}
                <div className="space-y-2">
                  {filteredGroups.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      {bimSearch ? 'No se encontraron grupos' : 'No hay elementos en esta importación'}
                    </div>
                  ) : (
                    filteredGroups.map(group => {
                      const estadoInfo = ESTADO_BIM[group.estado] || ESTADO_BIM.pendiente
                      const EstadoIcon = estadoInfo.icon
                      const isExpanded = expandedGroups.has(group.key)
                      const isMapping = mappingGroup === group.key
                      const paramKeys = Object.keys(group.sampleParams).filter(k =>
                        typeof group.sampleParams[k] === 'number' && group.sampleParams[k] > 0
                      )

                      return (
                        <div key={group.key} className="border rounded-lg overflow-hidden">
                          {/* Group header */}
                          <div
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                              group.estado === 'pendiente' ? 'bg-amber-50/50 hover:bg-amber-50' :
                              group.estado === 'mapeado' ? 'bg-blue-50/50 hover:bg-blue-50' :
                              group.estado === 'confirmado' ? 'bg-green-50/50 hover:bg-green-50' :
                              'bg-red-50/50 hover:bg-red-50'
                            }`}
                          >
                            <button onClick={() => toggleGroup(group.key)} className="flex-shrink-0">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </button>

                            <div className="flex-1 min-w-0" onClick={() => toggleGroup(group.key)}>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{group.categoriaEs}</span>
                                <span className="text-xs text-muted-foreground">/</span>
                                <span className="text-sm font-medium truncate">{group.familia}</span>
                                <span className="text-xs text-muted-foreground">/</span>
                                <span className="text-sm truncate">{group.tipo}</span>
                              </div>
                              {group.partida && (
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-blue-700">{group.partida.nombre}</span>
                                  {group.formula && (
                                    <code className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded font-mono text-muted-foreground">{group.formula}</code>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant="outline" className="text-[10px]">
                                <Layers className="w-3 h-3 mr-1" />
                                {group.elements.length}
                              </Badge>
                              {group.metradoTotal > 0 && (
                                <span className="text-xs font-mono font-medium">
                                  {group.metradoTotal.toFixed(2)} {group.partida?.unidad || ''}
                                </span>
                              )}
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${estadoInfo.color}`}>
                                <EstadoIcon className="w-3 h-3" />
                                {estadoInfo.label}
                              </span>

                              {/* Action buttons */}
                              {group.estado === 'pendiente' || group.estado === 'sin_match' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 text-xs"
                                  onClick={(e) => { e.stopPropagation(); startMapping(group.key, group) }}
                                >
                                  <Calculator className="w-3 h-3" />
                                  Mapear
                                </Button>
                              ) : group.estado === 'mapeado' ? (
                                <div className="flex gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 text-xs"
                                    onClick={(e) => { e.stopPropagation(); startMapping(group.key, group) }}
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 gap-1 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleBimConfirm(group.elements.map(el => el.id))
                                    }}
                                    disabled={bimConfirming}
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Confirmar
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {/* Inline mapping form */}
                          {isMapping && (
                            <div ref={mapFormRef} className="border-t bg-muted/30 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium flex items-center gap-2">
                                  <Calculator className="w-4 h-4 text-indigo-600" />
                                  Mapear {group.elements.length} elementos: {group.familia} / {group.tipo}
                                </h4>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMappingGroup(null)}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>

                              {/* Available parameters */}
                              {paramKeys.length > 0 && (
                                <div>
                                  <p className="text-[11px] text-muted-foreground mb-1.5">Parametros disponibles (click para insertar):</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {paramKeys.map(k => (
                                      <button
                                        key={k}
                                        onClick={() => setMapFormula(prev => prev ? `${prev} ${k}` : k)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background border text-xs hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                                      >
                                        <span className="font-mono font-medium text-indigo-700">{k}</span>
                                        <span className="text-muted-foreground">= {group.sampleParams[k]?.toFixed(2)}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Partida search */}
                              <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Partida destino</label>
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <Input
                                      placeholder="Buscar partida..."
                                      value={mapPartidaSearch}
                                      onChange={e => {
                                        setMapPartidaSearch(e.target.value)
                                        if (mapSelectedPartida && e.target.value !== mapSelectedPartida.nombre) {
                                          setMapSelectedPartida(null)
                                        }
                                      }}
                                      className="h-8 pl-8 text-xs"
                                      autoFocus
                                    />
                                    {mapSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                                  </div>
                                  {mapPartidaResults.length > 0 && !mapSelectedPartida && (
                                    <div className="absolute z-10 mt-1 w-full bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                      {mapPartidaResults.map(p => (
                                        <button
                                          key={p.id}
                                          onClick={() => {
                                            setMapSelectedPartida({ id: p.id, nombre: p.nombre, unidad: p.unidad })
                                            setMapPartidaSearch(p.nombre)
                                            setMapPartidaResults([])
                                          }}
                                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-xs"
                                        >
                                          <span className="font-medium">{p.nombre}</span>
                                          <span className="text-muted-foreground ml-2">({p.unidad})</span>
                                          {p.capitulo && <span className="text-muted-foreground ml-1">· {p.capitulo}</span>}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  {mapSelectedPartida && (
                                    <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      {mapSelectedPartida.nombre} ({mapSelectedPartida.unidad})
                                    </p>
                                  )}
                                </div>

                                {/* Formula */}
                                <div>
                                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Formula</label>
                                  <Input
                                    placeholder="Ej: Area * 1.05, Volume, Count"
                                    value={mapFormula}
                                    onChange={e => setMapFormula(e.target.value)}
                                    className="h-8 text-xs font-mono"
                                  />
                                  {mapFormula && (
                                    <p className={`text-[10px] mt-1 font-mono ${
                                      testFormula(mapFormula, group.sampleParams)?.startsWith('=')
                                        ? 'text-green-600'
                                        : 'text-red-500'
                                    }`}>
                                      {testFormula(mapFormula, group.sampleParams) || ''}
                                      {testFormula(mapFormula, group.sampleParams)?.startsWith('=') && mapSelectedPartida && (
                                        <span className="text-muted-foreground"> {mapSelectedPartida.unidad} (por elemento)</span>
                                      )}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center justify-between pt-1">
                                <p className="text-[10px] text-muted-foreground">
                                  Se aplicara la formula a {group.elements.length} elemento{group.elements.length !== 1 ? 's' : ''} de este grupo
                                </p>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setMappingGroup(null)}>
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs"
                                    disabled={!mapSelectedPartida || !mapFormula.trim() || mapSaving || testFormula(mapFormula, group.sampleParams)?.startsWith('Error')}
                                    onClick={() => handleGroupMap(group)}
                                  >
                                    {mapSaving ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Save className="w-3.5 h-3.5" />
                                    )}
                                    Mapear {group.elements.length} elementos
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Expanded: show individual elements */}
                          {isExpanded && (
                            <div className="border-t">
                              <div className="grid grid-cols-[1fr_1fr_100px_80px_80px] gap-2 px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30 border-b">
                                <span>Revit ID / Tipo</span>
                                <span>Partida</span>
                                <span className="text-right">Metrado</span>
                                <span className="text-center">Unidad</span>
                                <span className="text-center">Estado</span>
                              </div>
                              <div className="max-h-[300px] overflow-y-auto divide-y">
                                {group.elements.map(el => {
                                  const elEstado = ESTADO_BIM[el.estado] || ESTADO_BIM.pendiente
                                  const ElIcon = elEstado.icon
                                  const isEditing = editingBimElement === el.id
                                  return (
                                    <div key={el.id} className="group/el grid grid-cols-[1fr_1fr_100px_80px_80px] gap-2 items-center px-3 py-1.5 hover:bg-muted/20 transition-colors">
                                      <div className="min-w-0">
                                        <p className="text-xs truncate">{el.revit_id}</p>
                                        {Object.keys(el.parametros || {}).length > 0 && (
                                          <p className="text-[10px] text-muted-foreground truncate">
                                            {Object.entries(el.parametros)
                                              .filter(([, v]) => typeof v === 'number' && v > 0)
                                              .slice(0, 3)
                                              .map(([k, v]) => `${k}=${(v as number).toFixed(1)}`)
                                              .join(', ')}
                                          </p>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        {el.partidas ? (
                                          <p className="text-xs truncate">{el.partidas.nombre}</p>
                                        ) : (
                                          <span className="text-[10px] text-muted-foreground italic">Sin asignar</span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        {isEditing ? (
                                          <div className="flex items-center gap-0.5 justify-end">
                                            <Input
                                              type="number" step="0.01" min="0"
                                              value={editBimMetrado}
                                              onChange={e => setEditBimMetrado(e.target.value)}
                                              onKeyDown={e => {
                                                if (e.key === 'Enter') handleBimUpdateMetrado(el.id)
                                                if (e.key === 'Escape') setEditingBimElement(null)
                                              }}
                                              className="h-5 w-16 text-[10px] text-right"
                                              autoFocus
                                            />
                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleBimUpdateMetrado(el.id)}>
                                              <Check className="w-2.5 h-2.5 text-green-600" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => { setEditingBimElement(el.id); setEditBimMetrado((el.metrado_calculado ?? 0).toString()) }}
                                            className="text-xs font-mono hover:text-primary transition-colors"
                                          >
                                            {el.metrado_calculado != null ? el.metrado_calculado.toFixed(2) : '—'}
                                          </button>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-center text-muted-foreground">
                                        {el.partidas?.unidad || '—'}
                                      </span>
                                      <div className="flex justify-center">
                                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium ${elEstado.color}`}>
                                          <ElIcon className="w-2.5 h-2.5" />
                                          {elEstado.label}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Summary */}
                {elements.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>
                      {filteredGroups.length} grupo{filteredGroups.length !== 1 ? 's' : ''} · {filteredGroups.reduce((s, g) => s + g.elements.length, 0)} elementos
                      {bimSearch && ` (filtro: "${bimSearch}")`}
                    </span>
                    <span>
                      Metrado total: {filteredGroups.reduce((s, g) => s + g.metradoTotal, 0).toFixed(2)}
                    </span>
                  </div>
                )}
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
              <div className="grid grid-cols-[60px_1fr_100px_80px_60px_40px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b">
                <span>Codigo</span>
                <span>Partida</span>
                <span className="text-right">Metrado</span>
                <span className="text-center">Unidad</span>
                <span className="text-center">Origen</span>
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

                        return (
                          <div key={p.id} className="group grid grid-cols-[60px_1fr_100px_80px_60px_40px] gap-2 items-center px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
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
    </div>
  )
}
