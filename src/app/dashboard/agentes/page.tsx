'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatAgente } from '@/components/agentes/chat-agente'
import { Badge } from '@/components/ui/badge'
import {
  Bot, Brain, Scale, Calculator, Layers, DollarSign, Box,
  MapPin, Building2, ChevronRight,
} from 'lucide-react'
import type { AgentContext } from '@/lib/anthropic/agents'

interface Pais {
  id: string
  codigo: string
  nombre: string
}

interface Proyecto {
  id: string
  nombre: string
  pais_id: string
  tipologia: string | null
  paises: Pais | null
}

const AGENTES = [
  {
    id: 'orquestador',
    nombre: 'Orquestador',
    desc: 'Coordina, prioriza, sintetiza',
    icono: Brain,
    color: 'text-violet-600 bg-violet-100',
    placeholder: 'Ej: Necesito planificar las partidas de un edificio de 6 pisos',
  },
  {
    id: 'normativa',
    nombre: 'Normativa',
    desc: 'NB, RNE, ABNT, CSI',
    icono: Scale,
    color: 'text-blue-600 bg-blue-100',
    placeholder: 'Ej: Separacion maxima de estribos en columnas segun NB?',
  },
  {
    id: 'metrados',
    nombre: 'Metrados',
    desc: 'Cantidades, volumenes, BIM',
    icono: Calculator,
    color: 'text-green-600 bg-green-100',
    placeholder: 'Ej: Como calculo el metrado de tarrajeo interior?',
  },
  {
    id: 'partidas',
    nombre: 'Partidas',
    desc: 'Materiales + MO + equipos',
    icono: Layers,
    color: 'text-amber-600 bg-amber-100',
    placeholder: 'Ej: Desglose la partida de muro ladrillo soga e=15cm',
  },
  {
    id: 'presupuesto',
    nombre: 'Presupuesto',
    desc: 'CD + GG + impuestos',
    icono: DollarSign,
    color: 'text-emerald-600 bg-emerald-100',
    placeholder: 'Ej: Que impuestos aplican a construccion en Bolivia?',
  },
  {
    id: 'bim',
    nombre: 'BIM/Revit',
    desc: 'Revit 2025 → partidas',
    icono: Box,
    color: 'text-indigo-600 bg-indigo-100',
    placeholder: 'Ej: Como mapeo muros de Revit a partidas de albanileria?',
  },
]

export default function AgentesPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(null)
  const [selectedAgente, setSelectedAgente] = useState(AGENTES[0])
  const [isLoading, setIsLoading] = useState(true)

  const fetchProyectos = useCallback(async () => {
    try {
      const res = await fetch('/api/proyectos')
      if (!res.ok) throw new Error('Error')
      const data = await res.json()
      const rows = data as Proyecto[]
      setProyectos(rows)
      if (rows.length > 0) setSelectedProyecto(rows[0])
    } catch (error) {
      console.error('Error fetching proyectos:', error)
    } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchProyectos() }, [fetchProyectos])

  const buildContext = (proyecto: Proyecto): AgentContext => ({
    pais: proyecto.paises?.nombre || 'Bolivia',
    pais_codigo: proyecto.paises?.codigo || 'BO',
    tipologia: proyecto.tipologia || undefined,
    proyecto_nombre: proyecto.nombre,
    proyecto_id: proyecto.id,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* ===== CHAT AREA (fills remaining space) ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedProyecto ? (
          <ChatAgente
            key={`${selectedAgente.id}-${selectedProyecto.id}`}
            agente={selectedAgente.id}
            endpoint={`/api/agentes/${selectedAgente.id}`}
            contexto={buildContext(selectedProyecto)}
            placeholder={selectedAgente.placeholder}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3 px-8">
              <Bot className="w-16 h-16 mx-auto text-muted-foreground/20" />
              <h2 className="text-lg font-semibold text-muted-foreground">Sin proyecto</h2>
              <p className="text-sm text-muted-foreground/60">
                Crea un proyecto para consultar a los agentes IA
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ===== RIGHT SIDEBAR ===== */}
      <div className="w-64 border-l bg-card flex flex-col">
        {/* Project selector */}
        <div className="p-4 border-b space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proyecto</h3>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={selectedProyecto?.id || ''}
            onChange={e => {
              const p = proyectos.find(p => p.id === e.target.value)
              setSelectedProyecto(p || null)
            }}
          >
            {proyectos.length === 0 && <option value="">Sin proyectos</option>}
            {proyectos.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          {selectedProyecto && (
            <div className="space-y-1">
              {selectedProyecto.paises && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {selectedProyecto.paises.nombre}
                </div>
              )}
              {selectedProyecto.tipologia && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="w-3 h-3" />
                  {selectedProyecto.tipologia}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Agent selector */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            Agentes
          </h3>
          {AGENTES.map(ag => {
            const Icon = ag.icono
            const isActive = selectedAgente.id === ag.id
            return (
              <button
                key={ag.id}
                onClick={() => setSelectedAgente(ag)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-muted border border-transparent'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ag.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isActive ? 'text-primary' : ''}`}>
                    {ag.nombre}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{ag.desc}</p>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
              </button>
            )
          })}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t">
          <p className="text-[10px] text-muted-foreground/50 text-center">
            Modelo configurado en Configuracion
          </p>
        </div>
      </div>
    </div>
  )
}
