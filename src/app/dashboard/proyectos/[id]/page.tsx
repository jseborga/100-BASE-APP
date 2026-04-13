'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, MapPin, Building2, Calendar, Bot, FileSpreadsheet,
  Upload, Trash2, Check, X, Pencil, Plus, ChevronDown, ChevronRight, Download,
  LayoutTemplate, Loader2, Box, RefreshCw, CheckCircle2, AlertCircle, Clock,
  Search,
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
  revit_categorias: { id: string; nombre: string; nombre_es: string } | null
  partidas: { id: string; nombre: string; unidad: string; capitulo: string | null } | null
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href={`/dashboard/catalogo?proyecto=${proyectoId}`}>
          <Card className="hover:border-primary/40 transition-all cursor-pointer h-full">
            <CardContent className="py-5 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-100">
                <Plus className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Agregar partidas</h3>
                <p className="text-xs text-muted-foreground">Desde catálogo</p>
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
                <h3 className="font-semibold text-sm">Consultar agentes IA</h3>
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
                <h3 className="font-semibold text-sm">Cargar plantilla</h3>
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
        const filtered = elements.filter(el => {
          if (bimFilter !== 'all' && el.estado !== bimFilter) return false
          if (bimSearch) {
            const s = bimSearch.toLowerCase()
            return (
              el.tipo.toLowerCase().includes(s) ||
              el.familia.toLowerCase().includes(s) ||
              el.revit_categorias?.nombre_es?.toLowerCase().includes(s) ||
              el.partidas?.nombre?.toLowerCase().includes(s) ||
              el.revit_id.toLowerCase().includes(s)
            )
          }
          return true
        })
        const mapeados = elements.filter(e => e.estado === 'mapeado').length
        const confirmados = elements.filter(e => e.estado === 'confirmado').length
        const pendientes = elements.filter(e => e.estado === 'pendiente').length
        const sinMatch = elements.filter(e => e.estado === 'sin_match').length
        const latestImport = bimData.imports[0]

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
                      {latestImport.archivo_nombre} · {elements.length} elementos · {new Date(latestImport.created_at).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {mapeados > 0 && (
                    <Badge variant="outline" className="text-blue-600 bg-blue-50 text-[10px]">
                      {mapeados} mapeados
                    </Badge>
                  )}
                  {confirmados > 0 && (
                    <Badge variant="outline" className="text-green-600 bg-green-50 text-[10px]">
                      {confirmados} confirmados
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
                {/* Import history (if multiple) */}
                {bimData.imports.length > 1 && (
                  <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                    {bimData.imports.map((imp, i) => (
                      <span key={imp.id} className={i === 0 ? 'font-medium text-foreground' : ''}>
                        {imp.archivo_nombre} ({imp.total_elementos} elem, {imp.estado})
                        {i < bimData.imports.length - 1 && ' · '}
                      </span>
                    ))}
                  </div>
                )}

                {/* Filters + Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar elemento..."
                      value={bimSearch}
                      onChange={e => setBimSearch(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <select
                    value={bimFilter}
                    onChange={e => setBimFilter(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="all">Todos ({elements.length})</option>
                    <option value="mapeado">Mapeados ({mapeados})</option>
                    <option value="confirmado">Confirmados ({confirmados})</option>
                    <option value="pendiente">Pendientes ({pendientes})</option>
                    <option value="sin_match">Sin match ({sinMatch})</option>
                  </select>
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

                {/* Elements table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[140px_1fr_1fr_100px_80px_80px_60px] gap-2 px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/50 border-b">
                    <span>Categoria Revit</span>
                    <span>Familia / Tipo</span>
                    <span>Partida asignada</span>
                    <span className="text-right">Metrado</span>
                    <span className="text-center">Unidad</span>
                    <span className="text-center">Estado</span>
                    <span></span>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto divide-y">
                    {filtered.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        {bimSearch ? 'No se encontraron elementos' : 'No hay elementos en esta importación'}
                      </div>
                    ) : (
                      filtered.map(el => {
                        const estadoInfo = ESTADO_BIM[el.estado] || ESTADO_BIM.pendiente
                        const EstadoIcon = estadoInfo.icon
                        const isEditing = editingBimElement === el.id

                        return (
                          <div
                            key={el.id}
                            className="group grid grid-cols-[140px_1fr_1fr_100px_80px_80px_60px] gap-2 items-center px-3 py-2 hover:bg-muted/30 transition-colors"
                          >
                            {/* Categoria */}
                            <span className="text-xs text-muted-foreground truncate" title={el.revit_categorias?.nombre || ''}>
                              {el.revit_categorias?.nombre_es || el.revit_categorias?.nombre || '—'}
                            </span>

                            {/* Familia / Tipo */}
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate" title={el.tipo}>{el.tipo}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{el.familia} · {el.revit_id}</p>
                            </div>

                            {/* Partida asignada */}
                            <div className="min-w-0">
                              {el.partidas ? (
                                <p className="text-xs truncate" title={el.partidas.nombre}>
                                  {el.partidas.nombre}
                                </p>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Sin asignar</span>
                              )}
                            </div>

                            {/* Metrado */}
                            <div className="text-right">
                              {isEditing ? (
                                <div className="flex items-center gap-0.5 justify-end">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editBimMetrado}
                                    onChange={e => setEditBimMetrado(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleBimUpdateMetrado(el.id)
                                      if (e.key === 'Escape') setEditingBimElement(null)
                                    }}
                                    className="h-6 w-16 text-[11px] text-right"
                                    autoFocus
                                  />
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleBimUpdateMetrado(el.id)}>
                                    <Check className="w-2.5 h-2.5 text-green-600" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingBimElement(null)}>
                                    <X className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingBimElement(el.id)
                                    setEditBimMetrado((el.metrado_calculado ?? 0).toString())
                                  }}
                                  className="text-xs font-mono font-medium hover:text-primary transition-colors inline-flex items-center gap-0.5"
                                  title="Editar metrado"
                                >
                                  {el.metrado_calculado != null ? el.metrado_calculado.toFixed(2) : '—'}
                                  <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40" />
                                </button>
                              )}
                            </div>

                            {/* Unidad */}
                            <span className="text-[11px] text-center text-muted-foreground">
                              {el.partidas?.unidad || '—'}
                            </span>

                            {/* Estado */}
                            <div className="flex justify-center">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${estadoInfo.color}`}>
                                <EstadoIcon className="w-3 h-3" />
                                {estadoInfo.label}
                              </span>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end">
                              {el.estado === 'mapeado' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-green-600"
                                  onClick={() => handleBimConfirm([el.id])}
                                  title="Confirmar este elemento"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Summary */}
                {elements.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>
                      {filtered.length} de {elements.length} elementos
                      {bimSearch && ` (filtro: "${bimSearch}")`}
                    </span>
                    <span>
                      Metrado total: {filtered.reduce((s, e) => s + (e.metrado_calculado || 0), 0).toFixed(2)}
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
