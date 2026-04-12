'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Folder, MapPin, Calendar, Trash2, Pencil, X, Building2, ChevronRight } from 'lucide-react'

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
  org_id: string | null
  area_m2: number | null
  num_pisos: number | null
  paises: Pais | null
  created_at: string | null
  _count_partidas?: number
}

const TIPOLOGIAS = [
  'Residencial Unifamiliar',
  'Residencial Multifamiliar',
  'Comercial',
  'Industrial',
  'Educación',
  'Salud',
  'Oficinas',
  'Infraestructura Vial',
  'Otro',
]

const ESTADOS: Record<string, { label: string; color: string }> = {
  activo: { label: 'Activo', color: 'bg-emerald-100 text-emerald-800' },
  borrador: { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
  completado: { label: 'Completado', color: 'bg-blue-100 text-blue-800' },
  archivado: { label: 'Archivado', color: 'bg-amber-100 text-amber-700' },
}

export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [paises, setPaises] = useState<Pais[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [estadoChanging, setEstadoChanging] = useState<string | null>(null)

  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    pais_id: '',
    tipologia: '',
    ubicacion: '',
    area_m2: '',
    num_pisos: '',
  })

  const supabase = createClient()

  // Fetch projects via server-side API (bypasses RLS)
  const fetchProyectos = useCallback(async () => {
    try {
      const res = await fetch('/api/proyectos')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al cargar proyectos')
      }
      const data = await res.json()
      setProyectos(data)
    } catch (error) {
      console.error('Error fetching proyectos:', error)
      setFormError(error instanceof Error ? error.message : 'Error al cargar proyectos')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchPaises = useCallback(async () => {
    const { data } = await supabase.from('paises').select('id, codigo, nombre').order('nombre')
    setPaises((data ?? []) as unknown as Pais[])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchProyectos()
    fetchPaises()
  }, [fetchProyectos, fetchPaises])

  const resetForm = () => {
    setForm({ nombre: '', descripcion: '', pais_id: '', tipologia: '', ubicacion: '', area_m2: '', num_pisos: '' })
    setEditingId(null)
    setShowForm(false)
    setFormError(null)
  }

  const openEdit = (p: Proyecto) => {
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      pais_id: p.pais_id,
      tipologia: p.tipologia || '',
      ubicacion: p.ubicacion || '',
      area_m2: p.area_m2 ? String(p.area_m2) : '',
      num_pisos: p.num_pisos ? String(p.num_pisos) : '',
    })
    setEditingId(p.id)
    setShowForm(true)
    setFormError(null)
  }

  // Save via server-side API
  const handleSave = async () => {
    if (!form.nombre.trim() || !form.pais_id) {
      setFormError('El nombre y el país son obligatorios')
      return
    }
    setSaving(true)
    setFormError(null)

    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        pais_id: form.pais_id,
        tipologia: form.tipologia || undefined,
        ubicacion: form.ubicacion.trim() || undefined,
        area_m2: form.area_m2 ? parseFloat(form.area_m2) : undefined,
        num_pisos: form.num_pisos ? parseInt(form.num_pisos) : undefined,
      }

      let res: Response

      if (editingId) {
        res = await fetch('/api/proyectos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        })
      } else {
        res = await fetch('/api/proyectos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }

      resetForm()
      await fetchProyectos()
    } catch (error) {
      console.error('Error saving:', error)
      setFormError(error instanceof Error ? error.message : 'Error al guardar proyecto')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/proyectos?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setDeleteConfirm(null)
      await fetchProyectos()
    } catch (error) {
      console.error('Error deleting:', error)
      setFormError(error instanceof Error ? error.message : 'Error al eliminar')
    }
  }

  const handleEstadoChange = async (projectId: string, newEstado: string) => {
    setEstadoChanging(projectId)
    try {
      const res = await fetch('/api/proyectos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, estado: newEstado }),
      })
      if (!res.ok) throw new Error('Error al cambiar estado')
      await fetchProyectos()
    } catch (error) {
      console.error('Error changing estado:', error)
    } finally {
      setEstadoChanging(null)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Proyectos</h1>
          <p className="text-muted-foreground mt-1">
            {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} registrado{proyectos.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true) }} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo proyecto
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="border-primary/30 shadow-md">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Editar proyecto' : 'Nuevo proyecto'}
              </h2>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre del proyecto *</Label>
                  <Input
                    id="nombre"
                    placeholder="Ej: Edificio Residencial Los Pinos"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pais">País *</Label>
                  <select
                    id="pais"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.pais_id}
                    onChange={e => setForm({ ...form, pais_id: e.target.value })}
                  >
                    <option value="">Seleccionar país</option>
                    {paises.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipologia">Tipología</Label>
                  <select
                    id="tipologia"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.tipologia}
                    onChange={e => setForm({ ...form, tipologia: e.target.value })}
                  >
                    <option value="">Seleccionar tipología</option>
                    {TIPOLOGIAS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ubicacion">Ubicacion</Label>
                  <Input
                    id="ubicacion"
                    placeholder="Ej: La Paz, Zona Sur"
                    value={form.ubicacion}
                    onChange={e => setForm({ ...form, ubicacion: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="area_m2">Area aproximada (m2)</Label>
                  <Input
                    id="area_m2"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej: 850"
                    value={form.area_m2}
                    onChange={e => setForm({ ...form, area_m2: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="num_pisos">Numero de pisos</Label>
                  <Input
                    id="num_pisos"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ej: 6"
                    value={form.num_pisos}
                    onChange={e => setForm({ ...form, num_pisos: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripcion del proyecto</Label>
                <textarea
                  id="descripcion"
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Describe el proyecto con detalle: tipo de estructura, materiales principales, sistema constructivo, numero de departamentos/oficinas, sotanos, tipo de fundacion, acabados previstos, instalaciones especiales... Mientras mas detalle, mejores sugerencias del agente IA."
                  value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">
                  El agente IA usa esta descripcion para sugerir partidas. Se lo mas especifico posible.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving || !form.nombre.trim() || !form.pais_id}>
                  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear proyecto'}
                </Button>
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                ¿Eliminar este proyecto y todas sus partidas? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-2 ml-4">
                <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(deleteConfirm)}>Eliminar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects List */}
      {proyectos.length === 0 && !showForm ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Folder className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Sin proyectos</h2>
            <p className="text-muted-foreground">
              Crea tu primer proyecto para empezar a trabajar con metrados estandarizados
            </p>
            <Button onClick={() => setShowForm(true)}>Crear proyecto</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3">
          {proyectos.map((proyecto) => {
            const estado = ESTADOS[proyecto.estado || 'activo'] || ESTADOS.activo
            const pais = proyecto.paises

            return (
              <Card key={proyecto.id} className="hover:border-primary/40 transition-all group">
                <div className="flex items-center">
                  <Link href={`/dashboard/proyectos/${proyecto.id}`} className="flex-1 p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {proyecto.nombre}
                          </h3>
                          <select
                            value={proyecto.estado || 'activo'}
                            onChange={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleEstadoChange(proyecto.id, e.target.value)
                            }}
                            onClick={e => e.stopPropagation()}
                            disabled={estadoChanging === proyecto.id}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer appearance-none ${estado.color}`}
                          >
                            {Object.entries(ESTADOS).map(([key, val]) => (
                              <option key={key} value={key}>{val.label}</option>
                            ))}
                          </select>
                        </div>
                        {proyecto.descripcion && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {proyecto.descripcion}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {pais && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {pais.nombre}
                              {proyecto.ubicacion ? ` · ${proyecto.ubicacion}` : ''}
                            </span>
                          )}
                          {proyecto.tipologia && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {proyecto.tipologia}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(proyecto.created_at)}
                          </span>
                          <span className="font-medium text-foreground/70">
                            {proyecto._count_partidas || 0} partida{(proyecto._count_partidas || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                    </div>
                  </Link>

                  <div className="flex items-center gap-1 pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.preventDefault(); openEdit(proyecto) }}
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.preventDefault(); setDeleteConfirm(proyecto.id) }}
                      title="Eliminar"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}