'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
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
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  GitBranch,
  Cpu,
  Calculator,
  FileText,
  AlertCircle,
  Loader2,
  Copy,
  Layers,
  Info,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface RevitCategoria {
  id: string
  nombre: string
  nombre_es: string | null
  parametros_clave: string[]
}

interface Partida {
  id: string
  nombre: string
  unidad: string
  capitulo: string | null
}

interface Mapeo {
  id: string
  formula: string
  parametro_principal: string | null
  descripcion: string | null
  prioridad: number
  instrucciones_computo: string | null
  condicion_filtro: string | null
  revit_categoria_id: string
  revit_categorias: RevitCategoria | null
  partida_id: string
  partidas: Partida | null
}

interface SampleElement {
  familia: string
  tipo: string
  parametros: Record<string, unknown>
}

// All Revit parameters available from Add-in
const ALL_PARAMS: { name: string; desc: string; unit: string }[] = [
  { name: 'Area', desc: 'Area neta interior', unit: 'm2' },
  { name: 'AreaBruta', desc: 'Area bruta interior', unit: 'm2' },
  { name: 'AreaBrutaExt', desc: 'Area bruta exterior', unit: 'm2' },
  { name: 'AreaExt', desc: 'Area neta exterior', unit: 'm2' },
  { name: 'OpeningsArea', desc: 'Area de vanos descontados', unit: 'm2' },
  { name: 'OpeningsAreaTotal', desc: 'Area total de vanos', unit: 'm2' },
  { name: 'OpeningsAreaNoDesc', desc: 'Area vanos no descontados', unit: 'm2' },
  { name: 'Volume', desc: 'Volumen del elemento', unit: 'm3' },
  { name: 'Length', desc: 'Longitud / largo', unit: 'ml' },
  { name: 'Height', desc: 'Altura promedio', unit: 'm' },
  { name: 'Width', desc: 'Espesor / ancho', unit: 'm' },
  { name: 'Count', desc: 'Cantidad de instancias', unit: 'und' },
  { name: 'Cantidad', desc: 'Cantidad calculada', unit: 'und' },
  { name: 'CantidadPrincipal', desc: 'Cantidad principal', unit: 'und' },
  { name: 'CantidadConDesperdicio', desc: 'Cantidad con desperdicio', unit: 'und' },
  { name: 'FactorDesperdicio', desc: 'Factor de desperdicio', unit: '%' },
  { name: 'PesoLinealKgM', desc: 'Peso lineal', unit: 'kg/m' },
  { name: 'PesoTotalKg', desc: 'Peso total', unit: 'kg' },
  { name: 'RevEspInt', desc: 'Espesor revoque interior', unit: 'm' },
  { name: 'RevEspExt', desc: 'Espesor revoque exterior', unit: 'm' },
  { name: 'CeramicaAltura', desc: 'Altura de ceramica', unit: 'm' },
]

const CATEGORY_ICONS: Record<string, string> = {
  'Walls': '🧱', 'Structural Columns': '🏛️', 'Structural Framing': '🔩',
  'Floors': '⬛', 'Ceilings': '⬜', 'Roofs': '🏠', 'Doors': '🚪',
  'Windows': '🪟', 'Stairs': '🪜', 'Railings': '🔗',
  'Plumbing Fixtures': '🚿', 'Electrical Fixtures': '💡',
}

// ============================================================
// Empty form state
// ============================================================

interface FormState {
  revit_categoria_id: string
  partida_id: string
  formula: string
  parametro_principal: string
  descripcion: string
  instrucciones_computo: string
  prioridad: number
  condicion_filtro: string
}

const emptyForm: FormState = {
  revit_categoria_id: '',
  partida_id: '',
  formula: '',
  parametro_principal: '',
  descripcion: '',
  instrucciones_computo: '',
  prioridad: 0,
  condicion_filtro: '',
}

// ============================================================
// Component
// ============================================================

export default function MapeosPage() {
  const [mapeos, setMapeos] = useState<Mapeo[]>([])
  const [categorias, setCategorias] = useState<RevitCategoria[]>([])
  const [samples, setSamples] = useState<Record<string, SampleElement[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [expandedSamples, setExpandedSamples] = useState<Set<string>>(new Set())

  // Partida search for form
  const [partidaSearch, setPartidaSearch] = useState('')
  const [partidaResults, setPartidaResults] = useState<Partida[]>([])
  const [searchingPartidas, setSearchingPartidas] = useState(false)
  const [selectedPartida, setSelectedPartida] = useState<Partida | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formulaPreview, setFormulaPreview] = useState<string | null>(null)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ============================================================
  // Fetch data
  // ============================================================

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/mapeos')
      if (!res.ok) throw new Error('Error cargando mapeos')
      const data = await res.json()
      setMapeos(data.mapeos || [])
      setCategorias(data.categorias || [])
      setSamples(data.samples || {})

      // Expand first category with mapeos
      if (data.mapeos?.length > 0) {
        const firstCat = data.mapeos[0].revit_categoria_id
        setExpandedCats(new Set([firstCat]))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ============================================================
  // Partida search (debounced)
  // ============================================================

  useEffect(() => {
    if (partidaSearch.length < 2) {
      setPartidaResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingPartidas(true)
      try {
        const res = await fetch('/api/mapeos/partidas?q=' + encodeURIComponent(partidaSearch))
        if (res.ok) {
          const data = await res.json()
          setPartidaResults(data.partidas || [])
        }
      } catch { /* ignore */ }
      finally { setSearchingPartidas(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [partidaSearch])

  // ============================================================
  // Formula preview
  // ============================================================

  useEffect(() => {
    if (!form.formula.trim()) {
      setFormulaPreview(null)
      return
    }
    try {
      let expr = form.formula
      const testParams: Record<string, number> = {
        Area: 100, AreaBruta: 110, AreaBrutaExt: 100, AreaExt: 100,
        OpeningsArea: 10, OpeningsAreaTotal: 15, OpeningsAreaNoDesc: 5,
        Volume: 10, Length: 5, Height: 3, Width: 0.2, Count: 1,
        Cantidad: 1, CantidadPrincipal: 1, CantidadConDesperdicio: 1.05,
        FactorDesperdicio: 0.05, PesoLinealKgM: 2.5, PesoTotalKg: 12.5,
        RevEspInt: 0.015, RevEspExt: 0.02, CeramicaAltura: 1.8,
      }
      const sorted = Object.keys(testParams).sort((a, b) => b.length - a.length)
      for (const k of sorted) {
        expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), String(testParams[k]))
      }
      if (/[^0-9+\-*/().eE\s]/.test(expr)) {
        setFormulaPreview('Error: caracteres no validos')
        return
      }
      const result = Function(`"use strict"; return (${expr})`)()
      if (typeof result === 'number' && isFinite(result)) {
        setFormulaPreview(`= ${result.toFixed(4)} (con valores de prueba)`)
      } else {
        setFormulaPreview('Error: resultado no numérico')
      }
    } catch {
      setFormulaPreview('Error: fórmula inválida')
    }
  }, [form.formula])

  // ============================================================
  // Group mapeos by category
  // ============================================================

  const grouped = useMemo(() => {
    const map = new Map<string, { categoria: RevitCategoria; mapeos: Mapeo[] }>()

    // Include all categories (even those without mapeos)
    for (const cat of categorias) {
      map.set(cat.id, { categoria: cat, mapeos: [] })
    }

    for (const m of mapeos) {
      const catId = m.revit_categoria_id
      if (map.has(catId)) {
        map.get(catId)!.mapeos.push(m)
      } else if (m.revit_categorias) {
        map.set(catId, { categoria: m.revit_categorias, mapeos: [m] })
      }
    }

    let result = Array.from(map.values())

    // Filter
    if (filterCategoria) {
      result = result.filter(g => g.categoria.id === filterCategoria)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(g =>
        g.categoria.nombre.toLowerCase().includes(q) ||
        g.categoria.nombre_es?.toLowerCase().includes(q) ||
        g.mapeos.some(m =>
          m.partidas?.nombre.toLowerCase().includes(q) ||
          m.formula.toLowerCase().includes(q) ||
          m.descripcion?.toLowerCase().includes(q)
        )
      )
    }

    // Sort: categories with mapeos first, then alphabetically
    return result.sort((a, b) => {
      if (a.mapeos.length > 0 && b.mapeos.length === 0) return -1
      if (a.mapeos.length === 0 && b.mapeos.length > 0) return 1
      return a.categoria.nombre.localeCompare(b.categoria.nombre)
    })
  }, [mapeos, categorias, filterCategoria, searchQuery])

  // ============================================================
  // Actions
  // ============================================================

  const resetForm = () => {
    setForm(emptyForm)
    setShowForm(false)
    setEditingId(null)
    setFormError(null)
    setSelectedPartida(null)
    setPartidaSearch('')
    setPartidaResults([])
  }

  const openCreate = (categoriaId: string) => {
    resetForm()
    const catMapeos = mapeos.filter(m => m.revit_categoria_id === categoriaId)
    const nextPrioridad = catMapeos.length > 0
      ? Math.max(...catMapeos.map(m => m.prioridad)) + 1
      : 1
    setForm({ ...emptyForm, revit_categoria_id: categoriaId, prioridad: nextPrioridad })
    setShowForm(true)
    setExpandedCats(prev => new Set([...prev, categoriaId]))
  }

  const openEdit = (m: Mapeo) => {
    resetForm()
    setEditingId(m.id)
    setForm({
      revit_categoria_id: m.revit_categoria_id,
      partida_id: m.partida_id,
      formula: m.formula,
      parametro_principal: m.parametro_principal || '',
      descripcion: m.descripcion || '',
      instrucciones_computo: m.instrucciones_computo || '',
      prioridad: m.prioridad,
      condicion_filtro: m.condicion_filtro || '',
    })
    setSelectedPartida(m.partidas)
    setShowForm(true)
    setExpandedCats(prev => new Set([...prev, m.revit_categoria_id]))
  }

  const handleSave = async () => {
    setFormError(null)
    if (!form.revit_categoria_id) { setFormError('Seleccione una categoría'); return }
    if (!form.partida_id && !selectedPartida) { setFormError('Seleccione una partida del catálogo'); return }
    if (!form.formula.trim()) { setFormError('La fórmula es requerida'); return }

    setSaving(true)
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        revit_categoria_id: form.revit_categoria_id,
        partida_id: form.partida_id || selectedPartida?.id,
        formula: form.formula.trim(),
        parametro_principal: form.parametro_principal || null,
        descripcion: form.descripcion || null,
        instrucciones_computo: form.instrucciones_computo || null,
        prioridad: form.prioridad,
        condicion_filtro: form.condicion_filtro || null,
      }

      const res = await fetch('/api/mapeos', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || 'Error al guardar')
        return
      }

      resetForm()
      await fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/mapeos?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeletingId(null)
        await fetchData()
      }
    } catch { /* ignore */ }
  }

  const insertParam = (paramName: string) => {
    setForm(prev => ({
      ...prev,
      formula: prev.formula ? `${prev.formula} ${paramName}` : paramName,
    }))
  }

  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSamples = (id: string) => {
    setExpandedSamples(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando mapeos BIM...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center text-destructive">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchData}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalMapeos = mapeos.length
  const catsWithMapeos = new Set(mapeos.map(m => m.revit_categoria_id)).size
  const catsWithout = categorias.length - catsWithMapeos

  return (
    <div className="p-8 space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Mapeos BIM</h1>
          <p className="text-muted-foreground mt-2">
            Reglas de mapeo: Categoria Revit &rarr; Partida de construccion con formula de metrado
          </p>
        </div>
        <GitBranch className="w-12 h-12 text-muted-foreground opacity-20" />
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Reglas de mapeo</p>
                <p className="text-3xl font-bold mt-1">{totalMapeos}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <GitBranch className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Categorias Revit</p>
                <p className="text-3xl font-bold mt-1">{categorias.length}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Cpu className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Con reglas</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{catsWithMapeos}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Layers className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sin reglas</p>
                <p className="text-3xl font-bold mt-1 text-amber-600">{catsWithout}</p>
              </div>
              <div className="bg-amber-100 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTERS */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar por partida, formula o descripcion</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="search" placeholder="Ej: revoque, Area * 1.05, muro..." className="pl-10"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria Revit</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={filterCategoria} onChange={e => setFilterCategoria(e.target.value)}>
                <option value="">Todas las categorias</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>
                    {CATEGORY_ICONS[c.nombre] || ''} {c.nombre} {c.nombre_es ? `(${c.nombre_es})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* INFO BOX */}
      <Card className="bg-blue-50/50 border-blue-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3 text-sm">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-blue-800 space-y-1">
              <p className="font-medium">Como funcionan los mapeos</p>
              <p>Cada regla conecta una <strong>categoria Revit</strong> (ej. Walls) con una <strong>partida del catalogo</strong> (ej. Revoque interior) usando una <strong>formula</strong> que calcula el metrado a partir de los parametros del modelo BIM.</p>
              <p>Una categoria puede tener <strong>multiples reglas</strong> (derivados): un muro genera ladrillo + revoque interior + revoque exterior + pintura. La prioridad ordena la evaluacion.</p>
              <p>Las <strong>instrucciones de computo</strong> documentan como/por que se usa la formula y viajan de vuelta a Revit para referencia del modelador.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CREATE/EDIT FORM */}
      {showForm && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {editingId ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {editingId ? 'Editar regla de mapeo' : 'Nueva regla de mapeo'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Row 1: Categoria + Partida */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria Revit *</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={form.revit_categoria_id}
                  onChange={e => setForm(prev => ({ ...prev, revit_categoria_id: e.target.value }))}
                  disabled={!!editingId}
                >
                  <option value="">Seleccionar categoria...</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>
                      {CATEGORY_ICONS[c.nombre] || ''} {c.nombre} {c.nombre_es ? `(${c.nombre_es})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Partida del catalogo *</Label>
                {selectedPartida ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedPartida.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedPartida.capitulo} &middot; {selectedPartida.unidad}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSelectedPartida(null)
                      setForm(prev => ({ ...prev, partida_id: '' }))
                    }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar partida por nombre..."
                      className="pl-10"
                      value={partidaSearch}
                      onChange={e => setPartidaSearch(e.target.value)}
                    />
                    {searchingPartidas && (
                      <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {partidaResults.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {partidaResults.map(p => (
                          <button
                            key={p.id}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                            onClick={() => {
                              setSelectedPartida(p)
                              setForm(prev => ({ ...prev, partida_id: p.id }))
                              setPartidaSearch('')
                              setPartidaResults([])
                            }}
                          >
                            <span className="font-medium">{p.nombre}</span>
                            <span className="text-muted-foreground ml-2">({p.unidad})</span>
                            {p.capitulo && <span className="text-xs text-muted-foreground ml-2">{p.capitulo}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Formula + Preview */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calculator className="w-4 h-4" /> Formula de metrado *
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: (Area - OpeningsArea) * 1.05"
                  value={form.formula}
                  onChange={e => setForm(prev => ({ ...prev, formula: e.target.value }))}
                  className="font-mono"
                />
                <select
                  className="flex h-9 w-40 rounded-md border border-input bg-background px-2 py-1 text-sm flex-shrink-0"
                  value={form.parametro_principal}
                  onChange={e => setForm(prev => ({ ...prev, parametro_principal: e.target.value }))}
                >
                  <option value="">Param. principal</option>
                  {['Area', 'Volume', 'Length', 'Count', 'Height', 'Width'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {formulaPreview && (
                <p className={`text-xs font-mono ${
                  formulaPreview.startsWith('Error') ? 'text-destructive' : 'text-green-600'
                }`}>
                  {formulaPreview}
                </p>
              )}
              {/* Param chips */}
              <div className="flex gap-1 flex-wrap">
                <span className="text-xs text-muted-foreground mr-1 pt-1">Insertar:</span>
                {(form.revit_categoria_id
                  ? (categorias.find(c => c.id === form.revit_categoria_id)?.parametros_clave || ['Area', 'Volume', 'Length', 'Count'])
                  : ['Area', 'Volume', 'Length', 'Count', 'Height', 'Width']
                ).map(p => (
                  <button
                    key={p}
                    className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-mono"
                    onClick={() => insertParam(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-mono"
                  onClick={() => insertParam('OpeningsArea')}
                >
                  OpeningsArea
                </button>
                <button
                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-mono"
                  onClick={() => insertParam('* 1.05')}
                >
                  *1.05
                </button>
                <button
                  className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-mono"
                  onClick={() => insertParam('* 78.5')}
                >
                  *78.5 (acero)
                </button>
              </div>
            </div>

            {/* Row 3: Prioridad + Condicion */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Prioridad (orden de evaluacion)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.prioridad}
                  onChange={e => setForm(prev => ({ ...prev, prioridad: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground">Menor = se evalua primero</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Condicion / filtro (opcional)</Label>
                <Input
                  placeholder="Ej: familia contiene 'ladrillo', espesor > 0.15"
                  value={form.condicion_filtro}
                  onChange={e => setForm(prev => ({ ...prev, condicion_filtro: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Condicion para aplicar esta regla solo a ciertos tipos</p>
              </div>
            </div>

            {/* Row 4: Descripcion */}
            <div className="space-y-2">
              <Label>Descripcion de la regla</Label>
              <Input
                placeholder="Ej: Revoque interior: area de muro menos vanos, factor 1.05 por desperdicio"
                value={form.descripcion}
                onChange={e => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
              />
            </div>

            {/* Row 5: Instrucciones de computo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="w-4 h-4" /> Instrucciones de computo
                <Badge variant="outline" className="text-[10px]">viaja a Revit</Badge>
              </Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Como computar este elemento en el modelo BIM. Ej: 'Medir area neta interior descontando vanos. Incluir factor 1.05 por desperdicio en cortes y remates. No incluir muros de fachada exterior.'"
                value={form.instrucciones_computo}
                onChange={e => setForm(prev => ({ ...prev, instrucciones_computo: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Este texto se envia a Revit como guia para el modelador. Documenta como/por que se usa esta formula.
              </p>
            </div>

            {/* Error + Actions */}
            {formError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                {formError}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm} disabled={saving}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Guardando...</>
                  : <><Save className="w-4 h-4 mr-1" /> {editingId ? 'Actualizar' : 'Crear regla'}</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CATEGORIES + MAPEOS */}
      <div className="space-y-4">
        {grouped.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No se encontraron mapeos con los filtros seleccionados.
            </CardContent>
          </Card>
        ) : (
          grouped.map(({ categoria, mapeos: catMapeos }) => {
            const isExpanded = expandedCats.has(categoria.id)
            const icon = CATEGORY_ICONS[categoria.nombre] || '📦'
            const hasSamples = (samples[categoria.id]?.length || 0) > 0
            const showingSamples = expandedSamples.has(categoria.id)

            return (
              <Card key={categoria.id} className="overflow-hidden">
                {/* Category header */}
                <div className="flex items-center bg-slate-50 hover:bg-slate-100 transition-colors">
                  <button
                    onClick={() => toggleCat(categoria.id)}
                    className="flex-1 py-4 px-5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded
                        ? <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        : <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      }
                      <span className="text-xl">{icon}</span>
                      <div className="text-left">
                        <h3 className="font-semibold text-base">
                          {categoria.nombre}
                          {categoria.nombre_es && (
                            <span className="text-muted-foreground font-normal ml-2">({categoria.nombre_es})</span>
                          )}
                        </h3>
                        <div className="flex gap-2 mt-0.5">
                          <Badge variant={catMapeos.length > 0 ? 'default' : 'secondary'} className="text-xs">
                            {catMapeos.length} regla{catMapeos.length !== 1 ? 's' : ''}
                          </Badge>
                          {Array.isArray(categoria.parametros_clave) && categoria.parametros_clave.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Params: {categoria.parametros_clave.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                  <div className="pr-4 flex gap-1">
                    {hasSamples && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1"
                        onClick={() => toggleSamples(categoria.id)}
                        title="Ver datos de ejemplo de Revit"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        {showingSamples ? 'Ocultar datos' : 'Datos Revit'}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => openCreate(categoria.id)}
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar regla
                    </Button>
                  </div>
                </div>

                {/* Sample Revit data */}
                {showingSamples && hasSamples && (
                  <div className="border-t bg-amber-50/50 px-5 py-3">
                    <p className="text-xs font-medium text-amber-800 mb-2">
                      Datos de ejemplo de elementos Revit importados (para referencia al crear formulas):
                    </p>
                    <div className="space-y-2">
                      {samples[categoria.id].map((s, i) => {
                        // Separate numeric params from metadata
                        const numericParams: Record<string, number> = {}
                        const metadataParams: Record<string, string> = {}
                        for (const [k, v] of Object.entries(s.parametros || {})) {
                          if (k === '_metadata' && typeof v === 'object' && v !== null) {
                            Object.assign(metadataParams, v)
                          } else if (k === '_unique_id') {
                            continue
                          } else if (typeof v === 'number') {
                            numericParams[k] = v
                          }
                        }

                        return (
                          <div key={i} className="bg-white rounded border p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-amber-700">
                                {s.familia} &rarr; {s.tipo}
                              </span>
                            </div>
                            {/* Numeric parameters */}
                            <div className="flex gap-2 flex-wrap">
                              {Object.entries(numericParams)
                                .filter(([, v]) => v !== 0)
                                .map(([k, v]) => (
                                  <button
                                    key={k}
                                    className="px-2 py-1 text-xs bg-blue-50 border border-blue-200 rounded font-mono hover:bg-blue-100 cursor-pointer"
                                    onClick={() => {
                                      if (showForm) insertParam(k)
                                    }}
                                    title={`Click para insertar ${k} en la formula. Valor: ${v}`}
                                  >
                                    <span className="font-semibold">{k}</span>
                                    <span className="text-blue-500 ml-1">= {typeof v === 'number' ? v.toFixed(v < 1 ? 4 : 2) : v}</span>
                                  </button>
                                ))}
                            </div>
                            {/* Metadata */}
                            {Object.keys(metadataParams).length > 0 && (
                              <div className="flex gap-1.5 flex-wrap mt-2">
                                {Object.entries(metadataParams).slice(0, 6).map(([k, v]) => (
                                  <span key={k} className="px-1.5 py-0.5 text-[10px] bg-gray-100 rounded text-gray-600">
                                    {k}: {v}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Mapeos list */}
                {isExpanded && (
                  <CardContent className="pt-0">
                    {catMapeos.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground text-sm">
                        <p>Sin reglas de mapeo para esta categoria.</p>
                        <Button
                          variant="link"
                          size="sm"
                          className="mt-1"
                          onClick={() => openCreate(categoria.id)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Crear primera regla
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {catMapeos.map((m, idx) => {
                          const isDeleting = deletingId === m.id
                          return (
                            <div
                              key={m.id}
                              className={`py-3 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Priority badge */}
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                  {m.prioridad}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h4 className="font-medium text-sm">
                                        {m.partidas?.nombre || 'Partida eliminada'}
                                      </h4>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <Badge variant="secondary" className="text-xs">
                                          {m.partidas?.unidad || '?'}
                                        </Badge>
                                        {m.partidas?.capitulo && (
                                          <span className="text-xs text-muted-foreground">{m.partidas.capitulo}</span>
                                        )}
                                      </div>
                                    </div>
                                    {/* Actions */}
                                    <div className="flex gap-1 flex-shrink-0">
                                      <Button variant="ghost" size="sm" onClick={() => openEdit(m)}
                                        title="Editar regla">
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => setDeletingId(m.id)}
                                        title="Eliminar regla">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Formula */}
                                  <div className="mt-2 flex items-center gap-2">
                                    <Calculator className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                    <code className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded font-mono">
                                      {m.formula}
                                    </code>
                                    {m.parametro_principal && (
                                      <Badge variant="outline" className="text-[10px]">
                                        {m.parametro_principal}
                                      </Badge>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => navigator.clipboard.writeText(m.formula)}
                                      title="Copiar formula"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>

                                  {/* Description */}
                                  {m.descripcion && (
                                    <p className="text-xs text-muted-foreground mt-1">{m.descripcion}</p>
                                  )}

                                  {/* Instrucciones de computo */}
                                  {m.instrucciones_computo && (
                                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                                      <div className="flex items-center gap-1 mb-1">
                                        <FileText className="w-3 h-3 text-amber-600" />
                                        <span className="text-[10px] font-medium text-amber-700">Instrucciones de computo (viaja a Revit)</span>
                                      </div>
                                      <p className="text-xs text-amber-800 whitespace-pre-wrap">{m.instrucciones_computo}</p>
                                    </div>
                                  )}

                                  {/* Condicion filtro */}
                                  {m.condicion_filtro && (
                                    <div className="mt-1 text-xs text-purple-600">
                                      <span className="font-medium">Filtro:</span> {m.condicion_filtro}
                                    </div>
                                  )}

                                  {/* Delete confirmation */}
                                  {isDeleting && (
                                    <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded-md flex items-center gap-2">
                                      <span className="text-xs text-destructive">Eliminar esta regla?</span>
                                      <Button variant="destructive" size="sm" className="h-6 text-xs"
                                        onClick={() => handleDelete(m.id)}>
                                        Eliminar
                                      </Button>
                                      <Button variant="outline" size="sm" className="h-6 text-xs"
                                        onClick={() => setDeletingId(null)}>
                                        Cancelar
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })
        )}
      </div>

      {/* PARAMETER REFERENCE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Referencia de parametros Revit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {ALL_PARAMS.map(p => (
              <div key={p.name} className="flex items-center gap-2 text-xs p-1.5 bg-slate-50 rounded">
                <code className="font-mono font-semibold text-blue-700 min-w-[140px]">{p.name}</code>
                <span className="text-muted-foreground flex-1">{p.desc}</span>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">{p.unit}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-slate-50 rounded-md">
            <p className="text-xs font-medium mb-2">Formulas de ejemplo:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {[
                { f: '(Area - OpeningsArea) * 1.05', d: 'Area neta + 5% desperdicio' },
                { f: 'Volume', d: 'Volumen directo (HoAo)' },
                { f: 'Volume * 78.5', d: 'Acero: volumen * densidad kg/m3' },
                { f: 'Area / 0.09', d: 'Ladrillos: area / area unitaria' },
                { f: 'Count', d: 'Conteo de instancias' },
                { f: '(Width + Height * 2) * Length', d: 'Perimetro de seccion * largo' },
              ].map(({ f, d }) => (
                <div key={f} className="flex items-center gap-2 text-xs">
                  <code className="font-mono bg-blue-50 text-blue-800 px-2 py-0.5 rounded">{f}</code>
                  <span className="text-muted-foreground">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
