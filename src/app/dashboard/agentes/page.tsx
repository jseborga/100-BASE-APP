'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatAgente } from '@/components/agentes/chat-agente'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bot, Brain, Scale, Calculator, Layers, DollarSign, Box } from 'lucide-react'
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
    descripcion: 'Coordina agentes, prioriza y sintetiza',
    icono: Brain,
    color: 'bg-violet-100 text-violet-700',
    placeholder: 'Ej: Necesito ayuda para planificar las partidas de un edificio de 6 pisos',
  },
  {
    id: 'normativa',
    nombre: 'Normativa',
    descripcion: 'NB · RNE · ABNT · CSI · cita artículos exactos',
    icono: Scale,
    color: 'bg-blue-100 text-blue-700',
    placeholder: 'Ej: ¿Cuál es la separación máxima de estribos en columnas según NB?',
  },
  {
    id: 'metrados',
    nombre: 'Metrados',
    descripcion: 'Cantidades, volúmenes, interpreta BIM',
    icono: Calculator,
    color: 'bg-green-100 text-green-700',
    placeholder: 'Ej: ¿Cómo calculo el metrado de tarrajeo interior en muros?',
  },
  {
    id: 'partidas',
    nombre: 'Partidas APU',
    descripcion: 'Materiales + MO + equipos + subcontratos',
    icono: Layers,
    color: 'bg-amber-100 text-amber-700',
    placeholder: 'Ej: Desglose la partida de muro ladrillo soga e=15cm',
  },
  {
    id: 'presupuesto',
    nombre: 'Presupuesto',
    descripcion: 'CD + GG + utilidad + impuestos por país',
    icono: DollarSign,
    color: 'bg-emerald-100 text-emerald-700',
    placeholder: 'Ej: ¿Qué impuestos aplican a la construcción en Bolivia?',
  },
  {
    id: 'bim',
    nombre: 'BIM/Revit',
    descripcion: 'Revit 2025 → partidas, Add-in C#',
    icono: Box,
    color: 'bg-indigo-100 text-indigo-700',
    placeholder: 'Ej: ¿Cómo mapeo muros de Revit a partidas de albañilería?',
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
      if (!res.ok) throw new Error('Error loading projects')
      const data = await res.json()
      const rows = data as Proyecto[]
      setProyectos(rows)
      if (rows.length > 0) setSelectedProyecto(rows[0])
    } catch (error) {
      console.error('Error fetching proyectos:', error)
    } finally {
      setIsLoading(false)
    }
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
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 h-full flex flex-col">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Agentes IA</h1>
        <p className="text-muted-foreground mt-1">
          6 asistentes especializados para normativa, metrados, partidas, presupuesto y BIM
        </p>
      </div>

      {/* Project selector */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">Proyecto activo:</span>
            <select
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={selectedProyecto?.id || ''}
              onChange={e => {
                const p = proyectos.find(p => p.id === e.target.value)
                setSelectedProyecto(p || null)
              }}
            >
              {proyectos.length === 0 && (
                <option value="">No hay proyectos — crea uno primero</option>
              )}
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.paises?.codigo || '??'})
                </option>
              ))}
            </select>
            {selectedProyecto?.paises && (
              <Badge variant="outline">{selectedProyecto.paises.nombre}</Badge>
            )}
            {selectedProyecto?.tipologia && (
              <Badge variant="secondary" className="text-xs">{selectedProyecto.tipologia}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent tabs */}
      <div className="flex gap-2 flex-wrap">
        {AGENTES.map(agente => {
          const Icon = agente.icono
          const isActive = selectedAgente.id === agente.id
          return (
            <button
              key={agente.id}
              onClick={() => setSelectedAgente(agente)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                isActive
                  ? 'border-primary bg-primary/5 text-primary shadow-sm'
                  : 'border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {agente.nombre}
            </button>
          )
        })}
      </div>

      {/* Chat area */}
      {selectedProyecto ? (
        <div className="flex-1 min-h-0" style={{ height: 'calc(100vh - 380px)' }}>
          <ChatAgente
            key={`${selectedAgente.id}-${selectedProyecto.id}`}
            agente={selectedAgente.id}
            titulo={`Agente de ${selectedAgente.nombre}`}
            descripcion={selectedAgente.descripcion}
            endpoint={`/api/agentes/${selectedAgente.id}`}
            contexto={buildContext(selectedProyecto)}
            placeholder={selectedAgente.placeholder}
          />
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Bot className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Sin proyecto seleccionado</h2>
            <p className="text-muted-foreground">
              Crea un proyecto primero para consultar a los agentes IA con contexto
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}