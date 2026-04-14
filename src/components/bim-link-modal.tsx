'use client'

import { useState, useMemo, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Pencil, Check, X, Calculator } from 'lucide-react'

// ── Types ──

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
  estado: string
  partida: { id: string; nombre: string; unidad: string } | null
  partidas: Array<{ id: string; nombre: string; unidad: string; formula: string | null; metradoTotal: number }>
  metradoTotal: number
  suggestions: Array<{
    id: string
    formula: string
    descripcion: string | null
    partida_id: string
    partidas: { id: string; nombre: string; unidad: string } | null
  }>
}

interface MapeoLine {
  groupKey: string
  formula: string
  isExisting: boolean // true = already saved in DB
  resultado: number | null
}

interface BimLinkModalProps {
  open: boolean
  onClose: () => void
  partidaId: string
  partidaNombre: string
  partidaUnidad: string
  bimGroups: BimGroup[]
  activeImportId: string
  proyectoId: string
  onSaved: () => void
}

// ── Formula evaluation ──

function evalFormula(formula: string, params: Record<string, number>): number | null {
  if (!formula.trim()) return null
  try {
    let expr = formula
    const sortedKeys = Object.keys(params).sort((a, b) => b.length - a.length)
    for (const k of sortedKeys) {
      expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), String(params[k]))
    }
    if (/[^0-9+\-*/().eE\s]/.test(expr)) return null
    const r = Function(`"use strict"; return (${expr})`)()
    return typeof r === 'number' && isFinite(r) ? Math.round(r * 10000) / 10000 : null
  } catch {
    return null
  }
}

function calcGroupMetrado(formula: string, group: BimGroup): number | null {
  if (!formula.trim()) return null
  let total = 0
  let anyValid = false
  for (const el of group.elements) {
    const r = evalFormula(formula, el.parametros)
    if (r !== null) {
      total += r
      anyValid = true
    }
  }
  return anyValid ? Math.round(total * 10000) / 10000 : null
}

// ── Component ──

export default function BimLinkModal({
  open, onClose, partidaId, partidaNombre, partidaUnidad,
  bimGroups, activeImportId, proyectoId, onSaved,
}: BimLinkModalProps) {
  const [lines, setLines] = useState<MapeoLine[]>([])
  const [saving, setSaving] = useState(false)
  const [addingGroup, setAddingGroup] = useState(false)

  // Initialize lines from existing mapeos when modal opens
  const initLines = useCallback(() => {
    const existing: MapeoLine[] = []
    for (const group of bimGroups) {
      const mapeo = group.partidas.find(p => p.id === partidaId)
      if (mapeo) {
        const formula = mapeo.formula || ''
        existing.push({
          groupKey: group.key,
          formula,
          isExisting: true,
          resultado: calcGroupMetrado(formula, group),
        })
      }
    }
    setLines(existing)
    setAddingGroup(existing.length === 0) // auto-open add if no existing
  }, [bimGroups, partidaId])

  // Re-initialize when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) initLines()
    else onClose()
  }

  // Available groups (not already in lines)
  const availableGroups = useMemo(() => {
    const usedKeys = new Set(lines.map(l => l.groupKey))
    return bimGroups.filter(g => !usedKeys.has(g.key))
  }, [bimGroups, lines])

  // Add a new line
  const addLine = (groupKey: string) => {
    const group = bimGroups.find(g => g.key === groupKey)
    if (!group) return
    setLines(prev => [...prev, { groupKey, formula: '', isExisting: false, resultado: null }])
    setAddingGroup(false)
  }

  // Update formula for a line
  const updateFormula = (index: number, formula: string) => {
    setLines(prev => {
      const next = [...prev]
      const group = bimGroups.find(g => g.key === next[index].groupKey)
      next[index] = {
        ...next[index],
        formula,
        resultado: group ? calcGroupMetrado(formula, group) : null,
      }
      return next
    })
  }

  // Remove a line
  const removeLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  // Insert param name into formula at cursor (appends)
  const insertParam = (index: number, paramName: string) => {
    setLines(prev => {
      const next = [...prev]
      const current = next[index].formula
      const newFormula = current ? `${current} ${paramName}` : paramName
      const group = bimGroups.find(g => g.key === next[index].groupKey)
      next[index] = {
        ...next[index],
        formula: newFormula,
        resultado: group ? calcGroupMetrado(newFormula, group) : null,
      }
      return next
    })
  }

  // Total metrado across all lines
  const total = useMemo(() => {
    return lines.reduce((sum, l) => sum + (l.resultado || 0), 0)
  }, [lines])

  const validLines = lines.filter(l => l.formula.trim() && l.resultado !== null)
  const canSave = validLines.length > 0

  // Save all lines
  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      // 1. Remove mapeos for groups that were deleted from lines
      const currentGroupKeys = new Set(lines.map(l => l.groupKey))
      for (const group of bimGroups) {
        const hadMapeo = group.partidas.some(p => p.id === partidaId)
        if (hadMapeo && !currentGroupKeys.has(group.key)) {
          // This group was unlinked — remove the specific mapping
          await fetch(`/api/proyectos/${proyectoId}/bim`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'reset_group',
              importacion_id: activeImportId,
              revit_categoria_id: group.categoriaId,
              familia: group.familia,
              tipo: group.tipo,
              partida_id: partidaId,
            }),
          })
        }
      }

      // 2. Create/update mapeos for all lines with valid formulas
      for (const line of lines) {
        if (!line.formula.trim()) continue
        const group = bimGroups.find(g => g.key === line.groupKey)
        if (!group) continue

        await fetch(`/api/proyectos/${proyectoId}/bim`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            importacion_id: activeImportId,
            revit_categoria_id: group.categoriaId,
            familia: group.familia,
            tipo: group.tipo,
            partida_id: partidaId,
            formula: line.formula,
          }),
        })
      }

      // 3. Calculate total and update proyecto_partidas.metrado_bim
      let totalMetrado = 0
      for (const line of lines) {
        if (line.resultado) totalMetrado += line.resultado
      }

      await fetch(`/api/proyectos/${proyectoId}/bim`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_derived',
          partida_id: partidaId,
          metrado: totalMetrado,
          notas: lines
            .filter(l => l.formula.trim())
            .map(l => {
              const g = bimGroups.find(gr => gr.key === l.groupKey)
              return `${g?.familia}/${g?.tipo}: ${l.formula}`
            })
            .join(' + '),
        }),
      })

      onSaved()
      onClose()
    } catch (err) {
      console.error('Save BIM link error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="w-4 h-4 text-indigo-600" />
            Vincular BIM: {partidaNombre}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Seleccione grupos BIM y defina fórmulas individuales. Cada grupo puede tener su propia fórmula de metrado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 py-2">
          {/* Existing + new lines */}
          {lines.map((line, idx) => {
            const group = bimGroups.find(g => g.key === line.groupKey)
            if (!group) return null
            const paramKeys = Object.keys(group.sampleParams).filter(k => group.sampleParams[k] > 0).sort()

            return (
              <div key={`${line.groupKey}-${idx}`} className="border rounded-lg p-3 space-y-2 bg-white">
                {/* Group header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded">
                      {group.categoriaEs}
                    </span>
                    <span className="text-sm font-medium truncate">{group.familia}</span>
                    <span className="text-xs text-muted-foreground">/</span>
                    <span className="text-sm truncate">{group.tipo}</span>
                    <Badge variant="secondary" className="text-[9px]">
                      {group.elements.length} elem.
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                    onClick={() => removeLine(idx)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Clickable params */}
                <div className="flex flex-wrap gap-1">
                  {paramKeys.map(k => (
                    <button
                      key={k}
                      onClick={() => insertParam(idx, k)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 border text-[10px] hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                    >
                      <span className="font-mono font-medium text-indigo-700">{k}</span>
                      <span className="text-muted-foreground">
                        ={group.sampleParams[k] % 1 === 0 ? group.sampleParams[k] : group.sampleParams[k].toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Formula + result */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Ej: Volume * 130"
                      value={line.formula}
                      onChange={e => updateFormula(idx, e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="w-28 text-right">
                    {line.formula.trim() && (
                      <span className={`text-xs font-mono ${line.resultado !== null ? 'text-green-700' : 'text-red-600'}`}>
                        {line.resultado !== null
                          ? `= ${line.resultado.toFixed(2)} ${partidaUnidad}`
                          : 'Error'}
                      </span>
                    )}
                  </div>
                </div>

                {line.isExisting && (
                  <span className="text-[9px] text-muted-foreground">Mapeo existente — editar la fórmula para recalcular</span>
                )}
              </div>
            )
          })}

          {/* Add group section */}
          {addingGroup ? (
            <div className="border border-dashed rounded-lg p-3 space-y-2 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Seleccionar grupo BIM:</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setAddingGroup(false)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {availableGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">Todos los grupos ya están vinculados</p>
                ) : (
                  availableGroups.map(group => {
                    const paramKeys = Object.keys(group.sampleParams).filter(k => group.sampleParams[k] > 0)
                    return (
                      <button
                        key={group.key}
                        onClick={() => addLine(group.key)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-gray-200 bg-white text-left hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">{group.categoriaEs}</span>
                            <span className="text-xs font-medium truncate">{group.familia}</span>
                            <span className="text-[10px] text-muted-foreground">/</span>
                            <span className="text-xs truncate">{group.tipo}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{group.elements.length} elem.</span>
                            {paramKeys.slice(0, 4).map(k => (
                              <span key={k} className="text-[9px] font-mono text-indigo-600">
                                {k}={group.sampleParams[k] % 1 === 0 ? group.sampleParams[k] : group.sampleParams[k].toFixed(1)}
                              </span>
                            ))}
                          </div>
                          {group.partidas.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {group.partidas.map(pp => (
                                <span key={pp.id} className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded">
                                  {pp.nombre}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-9 text-xs gap-1.5 border-dashed"
              onClick={() => setAddingGroup(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar grupo BIM
            </Button>
          )}
        </div>

        {/* Footer with total + actions */}
        <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between">
          <div className="text-sm">
            {lines.length > 0 && (
              <span className="font-mono font-medium">
                Total: <span className="text-indigo-700">{total.toFixed(2)}</span> {partidaUnidad}
                <span className="text-muted-foreground text-xs ml-2">
                  ({validLines.length} grupo{validLines.length !== 1 ? 's' : ''})
                </span>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave || saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
