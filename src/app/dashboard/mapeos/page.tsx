'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Search, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Save, X,
  GitBranch, Cpu, Calculator, FileText, AlertCircle, Loader2, Copy,
  Layers, Sparkles, FolderOpen, FileBox, CheckCircle2, Clock,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface RevitCategoria {
  id: string; nombre: string; nombre_es: string | null; parametros_clave: string[]
}
interface Partida {
  id: string; nombre: string; unidad: string; capitulo: string | null
}
interface Mapeo {
  id: string; formula: string; parametro_principal: string | null
  descripcion: string | null; prioridad: number
  instrucciones_computo: string | null; condicion_filtro: string | null
  revit_categoria_id: string; revit_categorias: RevitCategoria | null
  partida_id: string; partidas: Partida | null
}
interface BimElemento {
  id: string; revit_id: string | null; revit_categoria_id: string | null
  familia: string | null; tipo: string | null
  parametros: Record<string, unknown>
  partida_id: string | null; metrado_calculado: number | null
  estado: string; notas_mapeo: string | null; formula_usada: string | null
  partida_codigo: string | null; partida_nombre: string | null
}
interface BimImportacion {
  id: string; archivo_nombre: string | null; total_elementos: number
  elementos_mapeados: number; estado: string; created_at: string
}
interface Proyecto {
  id: string; nombre: string; estado: string | null; tipologia: string | null
}

const CATEGORY_ICONS: Record<string, string> = {
  'Walls': '🧱', 'Structural Columns': '🏛️', 'Structural Framing': '🔩',
  'Floors': '⬛', 'Ceilings': '⬜', 'Roofs': '🏠', 'Doors': '🚪',
  'Windows': '🪟', 'Stairs': '🪜', 'Railings': '🔗',
  'Plumbing Fixtures': '🚿', 'Electrical Fixtures': '💡',
}

interface FormState {
  revit_categoria_id: string; partida_id: string; formula: string
  parametro_principal: string; descripcion: string
  instrucciones_computo: string; prioridad: number; condicion_filtro: string
}
const emptyForm: FormState = {
  revit_categoria_id: '', partida_id: '', formula: '',
  parametro_principal: '', descripcion: '',
  instrucciones_computo: '', prioridad: 0, condicion_filtro: '',
}

function testFormula(formula: string): string | null {
  if (!formula.trim()) return null
  try {
    let expr = formula
    const tp: Record<string, number> = {
      Area: 100, AreaBruta: 110, AreaBrutaExt: 100, AreaExt: 100,
      OpeningsArea: 10, OpeningsAreaTotal: 15, OpeningsAreaNoDesc: 5,
      Volume: 10, Length: 5, Height: 3, Width: 0.2, Count: 1,
      Cantidad: 1, CantidadPrincipal: 1, CantidadConDesperdicio: 1.05,
      FactorDesperdicio: 0.05, PesoLinealKgM: 2.5, PesoTotalKg: 12.5,
      RevEspInt: 0.015, RevEspExt: 0.02, CeramicaAltura: 1.8,
    }
    for (const k of Object.keys(tp).sort((a, b) => b.length - a.length)) {
      expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), String(tp[k]))
    }
    if (/[^0-9+\-*/().eE\s]/.test(expr)) return 'Error: caracteres no validos'
    const r = Function(`"use strict"; return (${expr})`)()
    return typeof r === 'number' && isFinite(r) ? `= ${r.toFixed(4)} (prueba)` : 'Error: no numerico'
  } catch { return 'Error: formula invalida' }
}

// ============================================================
// Component
// ============================================================

export default function MapeosPage() {
  const [mapeos, setMapeos] = useState<Mapeo[]>([])
  const [categorias, setCategorias] = useState<RevitCategoria[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [importaciones, setImportaciones] = useState<BimImportacion[]>([])
  const [elementos, setElementos] = useState<BimElemento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Project selector
  const [selectedProyecto, setSelectedProyecto] = useState('')
  const [loadingProyecto, setLoadingProyecto] = useState(false)

  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())

  // Form
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Partida search
  const [partidaSearch, setPartidaSearch] = useState('')
  const [partidaResults, setPartidaResults] = useState<Partida[]>([])
  const [searchingPartidas, setSearchingPartidas] = useState(false)
  const [selectedPartida, setSelectedPartida] = useState<Partida | null>(null)

  // AI + delete
  const [suggestingAI, setSuggestingAI] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formRef = useRef<HTMLDivElement>(null)

  // ============================================================
  // Fetch
  // ============================================================

  const fetchData = useCallback(async (proyectoId?: string) => {
    try {
      if (proyectoId) setLoadingProyecto(true)
      else setLoading(true)
      setError(null)
      const url = proyectoId ? `/api/mapeos?proyecto_id=${proyectoId}` : '/api/mapeos'
      const res = await fetch(url)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Error ${res.status}`)
      }
      const data = await res.json()
      setMapeos(data.mapeos || [])
      setCategorias(data.categorias || [])
      if (data.proyectos) setProyectos(data.proyectos)
      setImportaciones(data.importaciones || [])
      setElementos(data.elementos || [])

      // Auto-expand categories that have elements
      if (data.elementos?.length > 0) {
        const catIds = new Set(data.elementos.map((e: BimElemento) => e.revit_categoria_id).filter(Boolean))
        setExpandedCats(catIds as Set<string>)
      } else if (data.mapeos?.length > 0) {
        setExpandedCats(new Set([data.mapeos[0].revit_categoria_id]))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
      setLoadingProyecto(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSelectProyecto = useCallback((id: string) => {
    setSelectedProyecto(id)
    if (id) fetchData(id)
    else {
      setImportaciones([])
      setElementos([])
      fetchData()
    }
  }, [fetchData])

  // Partida search
  useEffect(() => {
    if (partidaSearch.length < 2) { setPartidaResults([]); return }
    const t = setTimeout(async () => {
      setSearchingPartidas(true)
      try {
        const res = await fetch('/api/mapeos/partidas?q=' + encodeURIComponent(partidaSearch))
        if (res.ok) { const d = await res.json(); setPartidaResults(d.partidas || []) }
      } catch { /* */ }
      finally { setSearchingPartidas(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [partidaSearch])

  // Scroll to form
  useEffect(() => {
    if (editingCatId && formRef.current) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    }
  }, [editingCatId])

  // ============================================================
  // Group data by category
  // ============================================================

  const grouped = useMemo(() => {
    const map = new Map<string, {
      categoria: RevitCategoria
      mapeos: Mapeo[]
      elementos: BimElemento[]
    }>()

    for (const cat of categorias) {
      map.set(cat.id, { categoria: cat, mapeos: [], elementos: [] })
    }
    for (const m of mapeos) {
      const c = m.revit_categoria_id
      if (map.has(c)) map.get(c)!.mapeos.push(m)
      else if (m.revit_categorias) map.set(c, { categoria: m.revit_categorias, mapeos: [m], elementos: [] })
    }
    for (const el of elementos) {
      if (el.revit_categoria_id && map.has(el.revit_categoria_id)) {
        map.get(el.revit_categoria_id)!.elementos.push(el)
      }
    }

    // Elements without category
    const sinCat = elementos.filter(e => !e.revit_categoria_id)

    let result = Array.from(map.values())

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(g =>
        g.categoria.nombre.toLowerCase().includes(q) ||
        g.categoria.nombre_es?.toLowerCase().includes(q) ||
        g.mapeos.some(m => m.partidas?.nombre.toLowerCase().includes(q) || m.formula.toLowerCase().includes(q)) ||
        g.elementos.some(e => e.familia?.toLowerCase().includes(q) || e.tipo?.toLowerCase().includes(q))
      )
    }

    // Sort: cats with elements first, then with mapeos, then alphabetical
    result.sort((a, b) => {
      if (a.elementos.length > 0 && b.elementos.length === 0) return -1
      if (a.elementos.length === 0 && b.elementos.length > 0) return 1
      if (a.mapeos.length > 0 && b.mapeos.length === 0) return -1
      if (a.mapeos.length === 0 && b.mapeos.length > 0) return 1
      return a.categoria.nombre.localeCompare(b.categoria.nombre)
    })

    return { groups: result, sinCat }
  }, [mapeos, categorias, elementos, searchQuery])

  // ============================================================
  // Unique element types per category (deduplicated by familia+tipo)
  // ============================================================

  function getUniqueTypes(elems: BimElemento[]) {
    const seen = new Map<string, BimElemento>()
    for (const e of elems) {
      const key = `${e.familia}::${e.tipo}`
      if (!seen.has(key)) seen.set(key, e)
    }
    return Array.from(seen.values())
  }

  // ============================================================
  // Actions
  // ============================================================

  const resetForm = useCallback(() => {
    setForm(emptyForm); setEditingCatId(null); setEditingId(null)
    setFormError(null); setSelectedPartida(null)
    setPartidaSearch(''); setPartidaResults([]); setSuggestingAI(false)
  }, [])

  const openCreate = useCallback((catId: string) => {
    resetForm()
    const catM = mapeos.filter(m => m.revit_categoria_id === catId)
    const pri = catM.length > 0 ? Math.max(...catM.map(m => m.prioridad)) + 1 : 1
    setForm({ ...emptyForm, revit_categoria_id: catId, prioridad: pri })
    setEditingCatId(catId)
    setExpandedCats(prev => new Set([...prev, catId]))
  }, [mapeos, resetForm])

  const openEdit = useCallback((m: Mapeo) => {
    resetForm()
    setEditingId(m.id)
    setEditingCatId(m.revit_categoria_id)
    setForm({
      revit_categoria_id: m.revit_categoria_id, partida_id: m.partida_id,
      formula: m.formula, parametro_principal: m.parametro_principal || '',
      descripcion: m.descripcion || '', instrucciones_computo: m.instrucciones_computo || '',
      prioridad: m.prioridad, condicion_filtro: m.condicion_filtro || '',
    })
    setSelectedPartida(m.partidas)
    setExpandedCats(prev => new Set([...prev, m.revit_categoria_id]))
  }, [resetForm])

  const handleSave = async () => {
    setFormError(null)
    const pid = form.partida_id || selectedPartida?.id
    if (!form.revit_categoria_id) { setFormError('Seleccione una categoria'); return }
    if (!pid) { setFormError('Seleccione una partida del catalogo'); return }
    if (!form.formula.trim()) { setFormError('La formula es requerida'); return }
    const preview = testFormula(form.formula)
    if (preview?.startsWith('Error')) { setFormError(preview); return }

    setSaving(true)
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        revit_categoria_id: form.revit_categoria_id, partida_id: pid,
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
        const d = await res.json().catch(() => ({}))
        setFormError(d.error || `Error ${res.status}`); return
      }
      resetForm()
      await fetchData(selectedProyecto || undefined)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error de conexion')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/mapeos?id=${id}`, { method: 'DELETE' })
    if (res.ok) { setDeletingId(null); await fetchData(selectedProyecto || undefined) }
  }

  const handleSuggestAI = async () => {
    if (!form.formula || (!form.partida_id && !selectedPartida)) return
    setSuggestingAI(true)
    try {
      const catName = categorias.find(c => c.id === form.revit_categoria_id)?.nombre || ''
      const partidaNombre = selectedPartida?.nombre || ''
      const catElems = elementos.filter(e => e.revit_categoria_id === form.revit_categoria_id)
      const sampleParams = catElems[0]?.parametros || null
      const res = await fetch('/api/mapeos/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: catName, partida: partidaNombre, formula: form.formula, parametro_principal: form.parametro_principal, sample_params: sampleParams }),
      })
      if (res.ok) {
        const d = await res.json()
        if (d.suggestion) setForm(prev => ({ ...prev, instrucciones_computo: d.suggestion }))
      } else {
        const d = await res.json().catch(() => ({}))
        setFormError(d.error || 'Error IA')
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error')
    } finally { setSuggestingAI(false) }
  }

  const insertParam = (p: string) => setForm(prev => ({ ...prev, formula: prev.formula ? `${prev.formula} ${p}` : p }))
  const toggleCat = (id: string) => setExpandedCats(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // ============================================================
  // Render helpers
  // ============================================================

  const formulaPreview = testFormula(form.formula)
  const formCatParams = categorias.find(c => c.id === form.revit_categoria_id)?.parametros_clave

  function renderElementCard(el: BimElemento, canInsert: boolean) {
    const params: Record<string, number> = {}
    const meta: Record<string, string> = {}
    for (const [k, v] of Object.entries(el.parametros || {})) {
      if (k === '_metadata' && typeof v === 'object' && v !== null) Object.assign(meta, v)
      else if (k !== '_unique_id' && typeof v === 'number' && v !== 0) params[k] = v
    }
    const isMapped = el.estado === 'mapeado' || el.estado === 'revisado'
    return (
      <div className={`rounded border p-3 text-xs ${isMapped ? 'bg-green-50/50 border-green-200' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-medium text-gray-800">
            {el.familia} &rarr; <strong>{el.tipo}</strong>
          </span>
          <div className="flex items-center gap-1.5">
            {isMapped && el.partida_codigo && (
              <Badge className="text-[10px] bg-green-100 text-green-800 border-green-300">{el.partida_codigo}</Badge>
            )}
            <Badge variant={isMapped ? 'default' : 'secondary'} className="text-[10px]">
              {el.estado}
            </Badge>
          </div>
        </div>
        {/* Numeric params — clickable to insert in formula */}
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(params).map(([k, v]) => (
            <button key={k}
              className={`px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded font-mono hover:bg-blue-100 transition-colors ${canInsert ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => { if (canInsert) insertParam(k) }}
              title={canInsert ? `Insertar ${k} en formula` : `${k} = ${v}`}>
              <span className="font-semibold">{k}</span>
              <span className="text-blue-500 ml-0.5">={v < 1 ? v.toFixed(4) : v.toFixed(2)}</span>
            </button>
          ))}
        </div>
        {/* Metadata tags */}
        {Object.keys(meta).length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1.5">
            {Object.entries(meta).slice(0, 8).map(([k, v]) => (
              <span key={k} className="px-1 py-0.5 bg-gray-100 rounded text-gray-500 text-[10px]">
                {k}: {v}
              </span>
            ))}
          </div>
        )}
        {/* Mapping info */}
        {isMapped && (el.formula_usada || el.partida_nombre) && (
          <div className="mt-1.5 pt-1.5 border-t border-green-200">
            {el.partida_nombre && <p className="text-green-700"><span className="font-medium">Partida:</span> {el.partida_nombre}</p>}
            {el.formula_usada && <p className="text-green-600 font-mono">Formula: {el.formula_usada}</p>}
            {el.metrado_calculado && <p className="text-green-700 font-medium">Metrado: {el.metrado_calculado}</p>}
            {el.notas_mapeo && <p className="text-amber-700 italic mt-0.5">{el.notas_mapeo}</p>}
          </div>
        )}
      </div>
    )
  }

  function renderForm() {
    return (
      <div ref={formRef} className="border-2 border-primary/30 bg-primary/5 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            {editingId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Editar regla de mapeo' : 'Nueva regla de mapeo'}
          </h4>
          <Button variant="ghost" size="sm" onClick={resetForm}><X className="w-4 h-4" /></Button>
        </div>

        {/* Partida */}
        <div className="space-y-2">
          <Label>Partida del catalogo *</Label>
          {selectedPartida ? (
            <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedPartida.nombre}</p>
                <p className="text-xs text-muted-foreground">{selectedPartida.capitulo} &middot; {selectedPartida.unidad}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedPartida(null); setForm(p => ({ ...p, partida_id: '' })) }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar partida... (ej: revoque, muro, piso)" className="pl-10"
                value={partidaSearch} onChange={e => setPartidaSearch(e.target.value)} autoFocus />
              {searchingPartidas && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              {partidaResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {partidaResults.map(p => (
                    <button key={p.id} className="w-full text-left px-3 py-2.5 hover:bg-muted text-sm border-b last:border-b-0"
                      onClick={() => { setSelectedPartida(p); setForm(prev => ({ ...prev, partida_id: p.id })); setPartidaSearch(''); setPartidaResults([]) }}>
                      <span className="font-medium">{p.nombre}</span>
                      <span className="text-muted-foreground ml-2">({p.unidad})</span>
                      {p.capitulo && <span className="text-xs text-muted-foreground block">{p.capitulo}</span>}
                    </button>
                  ))}
                </div>
              )}
              {partidaSearch.length >= 2 && !searchingPartidas && partidaResults.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Sin resultados.</p>
              )}
            </div>
          )}
        </div>

        {/* Formula */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Calculator className="w-4 h-4" /> Formula *</Label>
          <div className="flex gap-2">
            <Input placeholder="(Area - OpeningsArea) * 1.05" value={form.formula}
              onChange={e => setForm(p => ({ ...p, formula: e.target.value }))} className="font-mono text-sm" />
            <select className="flex h-9 w-32 rounded-md border border-input bg-background px-2 py-1 text-xs flex-shrink-0"
              value={form.parametro_principal} onChange={e => setForm(p => ({ ...p, parametro_principal: e.target.value }))}>
              <option value="">Param ppal</option>
              {['Area', 'Volume', 'Length', 'Count', 'Height', 'Width'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {formulaPreview && (
            <p className={`text-xs font-mono ${formulaPreview.startsWith('Error') ? 'text-destructive' : 'text-green-600'}`}>{formulaPreview}</p>
          )}
          <div className="flex gap-1 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1 pt-0.5">Insertar:</span>
            {(Array.isArray(formCatParams) && formCatParams.length > 0 ? formCatParams : ['Area', 'Volume', 'Length', 'Count', 'Height', 'Width']).map((p: string) => (
              <button key={p} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 font-mono" onClick={() => insertParam(p)}>{p}</button>
            ))}
            <button className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-mono" onClick={() => insertParam('OpeningsArea')}>OpeningsArea</button>
            <button className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-mono" onClick={() => insertParam('* 1.05')}>*1.05</button>
            <button className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-mono" onClick={() => insertParam('* 78.5')}>*78.5</button>
            <p className="text-[10px] text-muted-foreground w-full mt-1">Tip: click en los parametros de los elementos Revit arriba para insertarlos</p>
          </div>
        </div>

        {/* Prioridad + Descripcion */}
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label>Prioridad</Label>
            <Input type="number" min="0" value={form.prioridad} onChange={e => setForm(p => ({ ...p, prioridad: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1 col-span-3">
            <Label>Descripcion</Label>
            <Input placeholder="Revoque interior: area neta con factor 1.05" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
          </div>
        </div>

        {/* Instrucciones + AI */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" /> Instrucciones de computo
              <Badge variant="outline" className="text-[10px]">viaja a Revit</Badge>
            </Label>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7"
              disabled={suggestingAI || !form.formula || (!form.partida_id && !selectedPartida)}
              onClick={handleSuggestAI}>
              {suggestingAI ? <><Loader2 className="w-3 h-3 animate-spin" /> Generando...</> : <><Sparkles className="w-3 h-3" /> Sugerir con IA</>}
            </Button>
          </div>
          <textarea className="flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Como computar en Revit. Ej: 'Medir area neta interior descontando vanos...'"
            value={form.instrucciones_computo} onChange={e => setForm(p => ({ ...p, instrucciones_computo: e.target.value }))} />
          <p className="text-[10px] text-muted-foreground">Se envia a Revit via Sync Mapeo como COS_NOTAS_MAPEO.</p>
        </div>

        {formError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {formError}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2 border-t">
          <Button variant="outline" onClick={resetForm} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4 mr-1" /> {editingId ? 'Actualizar' : 'Crear regla'}</>}
          </Button>
        </div>
      </div>
    )
  }

  // ============================================================
  // Main render
  // ============================================================

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Cargando mapeos BIM...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="p-8">
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center text-destructive">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" /><p>{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => fetchData()}>Reintentar</Button>
        </CardContent>
      </Card>
    </div>
  )

  const totalMapeos = mapeos.length
  const totalElementos = elementos.length
  const elemMapeados = elementos.filter(e => e.estado === 'mapeado' || e.estado === 'revisado').length
  const proyectoActivo = proyectos.find(p => p.id === selectedProyecto)

  return (
    <div className="p-8 space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Mapeos BIM</h1>
          <p className="text-muted-foreground mt-2">
            Reglas de mapeo + datos Revit del proyecto activo
          </p>
        </div>
        <GitBranch className="w-12 h-12 text-muted-foreground opacity-20" />
      </div>

      {/* PROJECT SELECTOR */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-shrink-0">
              <FolderOpen className="w-5 h-5 text-primary" />
              <Label className="font-semibold">Proyecto activo:</Label>
            </div>
            <select className="flex h-9 flex-1 min-w-[250px] rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={selectedProyecto} onChange={e => handleSelectProyecto(e.target.value)}>
              <option value="">Seleccionar proyecto para ver datos BIM...</option>
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {p.estado} {p.tipologia ? `(${p.tipologia})` : ''}
                </option>
              ))}
            </select>
            {loadingProyecto && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
          </div>

          {/* Project BIM summary */}
          {proyectoActivo && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-background rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Importaciones</p>
                <p className="text-2xl font-bold">{importaciones.length}</p>
              </div>
              <div className="bg-background rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Elementos Revit</p>
                <p className="text-2xl font-bold">{totalElementos}</p>
              </div>
              <div className="bg-background rounded-lg border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Mapeados</p>
                <p className="text-2xl font-bold text-green-600">{elemMapeados}</p>
              </div>
              <div className="bg-background rounded-lg border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3 text-amber-500" /> Pendientes</p>
                <p className="text-2xl font-bold text-amber-600">{totalElementos - elemMapeados}</p>
              </div>
            </div>
          )}

          {!selectedProyecto && (
            <p className="mt-3 text-xs text-muted-foreground">
              Seleccione un proyecto para ver sus elementos BIM importados desde Revit junto a las reglas de mapeo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* STATS + SEARCH */}
      <div className="flex gap-4 flex-wrap items-end">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar partida, familia, tipo, formula..." className="pl-10"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3">
          <Badge variant="outline" className="text-sm py-1.5 px-3">
            <GitBranch className="w-3.5 h-3.5 mr-1.5" /> {totalMapeos} reglas
          </Badge>
          <Badge variant="outline" className="text-sm py-1.5 px-3">
            <Cpu className="w-3.5 h-3.5 mr-1.5" /> {categorias.length} categorias
          </Badge>
        </div>
      </div>

      {/* CATEGORIES */}
      <div className="space-y-4">
        {grouped.groups.map(({ categoria, mapeos: catMapeos, elementos: catElems }) => {
          const isExpanded = expandedCats.has(categoria.id)
          const icon = CATEGORY_ICONS[categoria.nombre] || '📦'
          const isFormHere = editingCatId === categoria.id
          const uniqueTypes = getUniqueTypes(catElems)
          const elemMapped = catElems.filter(e => e.estado === 'mapeado' || e.estado === 'revisado').length

          return (
            <Card key={categoria.id} className={`overflow-hidden ${isFormHere ? 'ring-2 ring-primary/40' : ''}`}>
              {/* Header */}
              <div className="flex items-center bg-slate-50 hover:bg-slate-100 transition-colors">
                <button onClick={() => toggleCat(categoria.id)} className="flex-1 py-3 px-5 flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                  <span className="text-xl">{icon}</span>
                  <div className="text-left">
                    <h3 className="font-semibold">
                      {categoria.nombre}
                      {categoria.nombre_es && <span className="text-muted-foreground font-normal ml-2">({categoria.nombre_es})</span>}
                    </h3>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      <Badge variant={catMapeos.length > 0 ? 'default' : 'secondary'} className="text-xs">
                        {catMapeos.length} regla{catMapeos.length !== 1 ? 's' : ''}
                      </Badge>
                      {catElems.length > 0 && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          {uniqueTypes.length} tipo{uniqueTypes.length !== 1 ? 's' : ''} Revit ({elemMapped}/{catElems.length} mapeados)
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
                <div className="pr-4">
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => openCreate(categoria.id)}>
                    <Plus className="w-3.5 h-3.5" /> Regla
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <CardContent className="pt-0 space-y-0">
                  {/* Revit elements from project */}
                  {catElems.length > 0 && (
                    <div className="border-t bg-blue-50/30 px-4 py-3">
                      <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5" />
                        Elementos Revit del proyecto ({uniqueTypes.length} tipos, click en parametros para insertar en formula)
                      </p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                        {uniqueTypes.map(el => (
                          <div key={el.id}>{renderElementCard(el, isFormHere)}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline form */}
                  {isFormHere && (
                    <div className="border-t px-4 py-3">{renderForm()}</div>
                  )}

                  {/* Existing mapeo rules */}
                  {catMapeos.length > 0 ? (
                    <div className="divide-y border-t">
                      <div className="px-4 py-2 bg-slate-50">
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <GitBranch className="w-3.5 h-3.5" /> Reglas de mapeo existentes
                        </p>
                      </div>
                      {catMapeos.map((m, idx) => (
                        <div key={m.id} className={`px-4 py-3 ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{m.prioridad}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-medium text-sm">{m.partidas?.nombre || 'Partida eliminada'}</h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant="secondary" className="text-xs">{m.partidas?.unidad || '?'}</Badge>
                                    {m.partidas?.capitulo && <span className="text-xs text-muted-foreground">{m.partidas.capitulo}</span>}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openEdit(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                                    onClick={() => setDeletingId(deletingId === m.id ? null : m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                </div>
                              </div>
                              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                <Calculator className="w-3.5 h-3.5 text-blue-500" />
                                <code className="text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-mono">{m.formula}</code>
                                {m.parametro_principal && <Badge variant="outline" className="text-[10px]">{m.parametro_principal}</Badge>}
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => navigator.clipboard.writeText(m.formula)}><Copy className="w-3 h-3" /></Button>
                              </div>
                              {m.descripcion && <p className="text-xs text-muted-foreground mt-1">{m.descripcion}</p>}
                              {m.instrucciones_computo && (
                                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-md">
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <FileText className="w-3 h-3 text-amber-600" />
                                    <span className="text-[10px] font-medium text-amber-700">Instrucciones (viaja a Revit)</span>
                                  </div>
                                  <p className="text-xs text-amber-800 whitespace-pre-wrap">{m.instrucciones_computo}</p>
                                </div>
                              )}
                              {deletingId === m.id && (
                                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/30 rounded-md flex items-center gap-2">
                                  <span className="text-xs text-destructive">Eliminar?</span>
                                  <Button variant="destructive" size="sm" className="h-6 text-xs" onClick={() => handleDelete(m.id)}>Si</Button>
                                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setDeletingId(null)}>No</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !isFormHere ? (
                    <div className="border-t py-4 text-center text-muted-foreground text-sm">
                      Sin reglas. <Button variant="link" size="sm" onClick={() => openCreate(categoria.id)}><Plus className="w-3.5 h-3.5 mr-1" /> Crear primera</Button>
                    </div>
                  ) : null}
                </CardContent>
              )}
            </Card>
          )
        })}

        {/* Elements without category */}
        {grouped.sinCat.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-5 h-5" />
                Elementos sin categoria ({grouped.sinCat.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                {getUniqueTypes(grouped.sinCat).map(el => (
                  <div key={el.id}>{renderElementCard(el, false)}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* REFERENCE */}
      <Card className="bg-slate-50">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-medium mb-2">Formulas de ejemplo:</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
            {[
              { f: '(Area - OpeningsArea) * 1.05', d: 'Area neta + desperdicio' },
              { f: 'Volume', d: 'Volumen directo' },
              { f: 'Volume * 78.5', d: 'Acero kg' },
              { f: 'Area / 0.09', d: 'Ladrillos und' },
              { f: 'Count', d: 'Conteo instancias' },
              { f: '(Width + Height * 2) * Length', d: 'Perimetro * largo' },
            ].map(({ f, d }) => (
              <div key={f} className="flex items-center gap-2 text-xs">
                <code className="font-mono bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded text-[11px]">{f}</code>
                <span className="text-muted-foreground">{d}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
