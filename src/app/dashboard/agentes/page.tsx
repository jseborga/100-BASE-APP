'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChatAgente } from '@/components/agentes/chat-agente'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bot, Scale } from 'lucide-react'
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

export default function AgentesPage() {
  const supabase = createClient()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProyectos = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('proyectos')
        .select('id, nombre, pais_id, tipologia, paises(id, codigo, nombre)')
        .eq('propietario_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = (data ?? []) as unknown as Proyecto[]
      setProyectos(rows)
      if (rows.length > 0) setSelectedProyecto(rows[0])
    } catch (error) {
      console.error('Error fetching proyectos:', error)
    } finally {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agentes IA</h1>
          <p className="text-muted-foreground mt-1">
            Asistentes especializados para normativa, metrados y presupuestos
          </p>
        </div>
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
                <option value="">No hay proyectos</option>
              )}
              {proyectos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.paises?.codigo || '??'})
                </option>
              ))}
            </select>
            {selectedProyecto?.paises && (
              <Badge variant="outline">
                {selectedProyecto.paises.nombre}
              </Badge>
            )}
            {selectedProyecto?.tipologia && (
              <Badge variant="secondary" className="text-xs">
                {selectedProyecto.tipologia}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agents grid */}
      {selectedProyecto ? (
        <div className="flex-1 min-h-0" style={{ height: 'calc(100vh - 320px)' }}>
          <ChatAgente
            agente="normativa"
            titulo="Agente de Normativa"
            descripcion="Consulta normas de construcci\u00f3n: NB, RNE, ABNT, CSI. Cita art\u00edculos exactos."
            endpoint="/api/agentes/normativa"
            contexto={buildContext(selectedProyecto)}
            placeholder="Ej: \u00bfCu\u00e1l es la separaci\u00f3n m\u00e1xima de estribos en columnas seg\u00fan NB?"
          />
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Bot className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Sin proyecto seleccionado</h2>
            <p className="text-muted-foreground">
              Crea un proyecto primero para poder consultar a los agentes IA con contexto
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
