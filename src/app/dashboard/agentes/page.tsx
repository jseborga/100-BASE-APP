'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatAgente } from '@/components/agentes/chat-agente'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Bot, Brain, Scale, Calculator, Layers, DollarSign, Box,
  MapPin, Building2, ChevronRight, Settings, Search, Zap,
  ArrowRight, Info, Loader2, PanelRightClose, PanelRightOpen,
} from 'lucide-react'
import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { AgentContext } from '@/lib/anthropic/agents'

// ============================================================
// Types
// ============================================================

interface Pais {
  id: string
  codigo: string
  nombre: string
}

interface Proyecto {
  id: string
  nombre: string
  descripcion: string | null
  pais_id: string
  tipologia: string | null
  ubicacion: string | null
  area_m2: number | null
  num_pisos: number | null
  paises: Pais | null
}

interface AgentConfigItem {
  provider: string
  model: string
  isCustom: boolean
}

// ============================================================
// Agent metadata (icons, colors, descriptions)
// ============================================================

const AGENT_META: Record<string, {
  nombre: string
  desc: string
  rol: string
  icono: typeof Brain
  color: string
  placeholder: string
  actualizaProyecto: string
}> = {
  orquestador: {
    nombre: 'Orquestador',
    desc: 'Coordina, prioriza, sintetiza',
    rol: 'Recibe tu consulta, decide que agente(s) activar, y sintetiza la respuesta. Analiza partidas del proyecto y sugiere mejoras.',
    icono: Brain,
    color: 'text-violet-600 bg-violet-100',
    placeholder: 'Ej: Analiza las partidas de este proyecto y dime que falta',
    actualizaProyecto: 'Analiza partidas existentes, sugiere partidas faltantes, detecta inconsistencias',
  },
  normativa: {
    nombre: 'Normativa',
    desc: 'NB, RNE, ABNT, CSI',
    rol: 'Consulta normativas constructivas de cada pais. Cita articulos exactos y requisitos tecnicos.',
    icono: Scale,
    color: 'text-blue-600 bg-blue-100',
    placeholder: 'Ej: Separacion maxima de estribos en columnas segun NB?',
    actualizaProyecto: 'Valida que las partidas cumplan normativa vigente del pais',
  },
  metrados: {
    nombre: 'Metrados',
    desc: 'Cantidades, volumenes, BIM',
    rol: 'Calcula cantidades, volumenes y areas. Valida metrados de BIM y sugiere formulas.',
    icono: Calculator,
    color: 'text-green-600 bg-green-100',
    placeholder: 'Ej: Como calculo el metrado de tarrajeo interior?',
    actualizaProyecto: 'Valida metrados ingresados, sugiere formulas de calculo, detecta errores',
  },
  partidas: {
    nombre: 'Partidas APU',
    desc: 'Materiales + MO + equipos',
    rol: 'Desglosa partidas en componentes: materiales, mano de obra, equipos y subcontratos.',
    icono: Layers,
    color: 'text-amber-600 bg-amber-100',
    placeholder: 'Ej: Desglose la partida de muro ladrillo soga e=15cm',
    actualizaProyecto: 'Define estructura APU de cada partida (sin precios, eso va a Odoo)',
  },
  presupuesto: {
    nombre: 'Presupuesto',
    desc: 'CD + GG + impuestos',
    rol: 'Estructura presupuestaria: Costo Directo, Gastos Generales, Utilidad, Impuestos por pais.',
    icono: DollarSign,
    color: 'text-emerald-600 bg-emerald-100',
    placeholder: 'Ej: Que impuestos aplican a construccion en Bolivia?',
    actualizaProyecto: 'Valida estructura de costos y calcula impuestos por pais',
  },
  bim: {
    nombre: 'BIM/Revit',
    desc: 'Revit 2025 → partidas',
    rol: 'Mapea categorias de Revit 2025 a partidas de construccion. Interpreta LOD y parametros.',
    icono: Box,
    color: 'text-indigo-600 bg-indigo-100',
    placeholder: 'Ej: Como mapeo muros de Revit a partidas de albanileria?',
    actualizaProyecto: 'Mapea elementos BIM a partidas, calcula metrados automaticos',
  },
}

// ============================================================
// Quick analysis prompts
// ============================================================

const QUICK_ACTIONS = [
  {
    label: 'Analizar partidas',
    prompt: 'Analiza las partidas actuales de este proyecto. Identifica capitulos faltantes, partidas que deberian estar segun la tipologia, e inconsistencias en los metrados.',
    icon: Search,
    agent: 'orquestador',
  },
  {
    label: 'Sugerir partidas faltantes',
    prompt: 'Basandote en la tipologia del proyecto y las partidas actuales, sugiere las partidas especificas que faltan organizadas por capitulo. Prioriza las mas comunes primero.',
    icon: Zap,
    agent: 'orquestador',
  },
  {
    label: 'Revisar normativa',
    prompt: 'Revisa las partidas actuales del proyecto y verifica que cumplan con la normativa vigente del pais. Señala cualquier partida que requiera atencion especial.',
    icon: Scale,
    agent: 'normativa',
  },
]

// ============================================================
// Component
// ============================================================

export default function AgentesPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(null)
  const [selectedAgente, setSelectedAgente] = useState<string | null>(null)
  const [agentConfig, setAgentConfig] = useState<Record<string, AgentConfigItem>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [showOrchestration, setShowOrchestration] = useState(false)
  const [quickPrompt, setQuickPrompt] = useState<string | null>(null)
  const [chatKey, setChatKey] = useState(0)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('cos-agents-sidebar')
    if (saved === 'true') setRightCollapsed(true)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [proyRes, agentRes] = await Promise.all([
        fetch('/api/proyectos'),
        fetch('/api/config/agentes'),
      ])

      if (proyRes.ok) {
        const data = await proyRes.json()
        const rows = data as Proyecto[]
        setProyectos(rows)
        if (rows.length > 0) setSelectedProyecto(rows[0])
      }

      if (agentRes.ok) {
        const data = await agentRes.json()
        setAgentConfig(data.config || {})
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Build list of available agents from config
  const availableAgents = Object.entries(agentConfig)
    .filter(([slug, cfg]) => cfg.isCustom && AGENT_META[slug])
    .map(([slug, cfg]) => ({
      id: slug,
      ...AGENT_META[slug],
      provider: cfg.provider,
      model: cfg.model,
    }))

  // Auto-select first agent
  useEffect(() => {
    if (availableAgents.length > 0 && !selectedAgente) {
      setSelectedAgente(availableAgents[0].id)
    }
  }, [availableAgents, selectedAgente])

  const currentAgent = selectedAgente ? AGENT_META[selectedAgente] : null
  const currentConfig = selectedAgente ? agentConfig[selectedAgente] : null

  const buildContext = (proyecto: Proyecto): AgentContext => ({
    pais: proyecto.paises?.nombre || 'Bolivia',
    pais_codigo: proyecto.paises?.codigo || 'BO',
    tipologia: proyecto.tipologia || undefined,
    proyecto_nombre: proyecto.nombre,
    proyecto_id: proyecto.id,
    proyecto_descripcion: proyecto.descripcion || undefined,
    area_m2: proyecto.area_m2 || undefined,
    pisos: proyecto.num_pisos || undefined,
    region: proyecto.ubicacion || undefined,
  })

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    // Switch to the right agent and send the prompt
    if (agentConfig[action.agent]?.isCustom) {
      setSelectedAgente(action.agent)
      setQuickPrompt(action.prompt)
      setChatKey(prev => prev + 1)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  // No agents configured
  if (availableAgents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-md px-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Bot className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <h2 className="text-lg font-semibold">Agentes no configurados</h2>
          <p className="text-sm text-muted-foreground">
            Configura los agentes IA en la pagina de Configuracion. Necesitas agregar una API key
            y asignar un modelo a cada agente que quieras usar.
          </p>
          <Link href="/dashboard/configuracion">
            <Button className="gap-2">
              <Settings className="w-4 h-4" />
              Ir a Configuracion
            </Button>
          </Link>

          {/* Show orchestration diagram even without config */}
          <div className="pt-6 border-t mt-6">
            <OrchestrationPanel />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* ===== CHAT AREA ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedProyecto && selectedAgente && currentAgent ? (
          <>
            {/* Quick actions bar */}
            {selectedAgente === 'orquestador' && (
              <div className="border-b bg-muted/30 px-4 py-2 flex items-center gap-2 overflow-x-auto">
                <span className="text-xs text-muted-foreground font-medium shrink-0">Acciones rapidas:</span>
                {QUICK_ACTIONS.map((action, i) => {
                  const Icon = action.icon
                  const isAvailable = agentConfig[action.agent]?.isCustom
                  return (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs shrink-0 h-7"
                      onClick={() => handleQuickAction(action)}
                      disabled={!isAvailable}
                    >
                      <Icon className="w-3 h-3" />
                      {action.label}
                    </Button>
                  )
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs shrink-0 h-7 ml-auto"
                  onClick={() => setShowOrchestration(!showOrchestration)}
                >
                  <Info className="w-3 h-3" />
                  {showOrchestration ? 'Cerrar info' : 'Como funcionan'}
                </Button>
              </div>
            )}

            {/* Orchestration panel */}
            {showOrchestration && (
              <div className="border-b bg-card p-4">
                <OrchestrationPanel compact />
              </div>
            )}

            <ChatAgente
              key={`${selectedAgente}-${selectedProyecto.id}-${chatKey}`}
              agente={selectedAgente}
              endpoint={`/api/agentes/${selectedAgente}`}
              contexto={buildContext(selectedProyecto)}
              placeholder={currentAgent.placeholder}
              initialPrompt={quickPrompt || undefined}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3 px-8">
              <Bot className="w-16 h-16 mx-auto text-muted-foreground/20" />
              <h2 className="text-lg font-semibold text-muted-foreground">
                {!selectedProyecto ? 'Sin proyecto' : 'Selecciona un agente'}
              </h2>
              <p className="text-sm text-muted-foreground/60">
                {!selectedProyecto
                  ? 'Crea un proyecto para consultar a los agentes IA'
                  : 'Selecciona un agente de la barra lateral'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ===== RIGHT SIDEBAR ===== */}
      <TooltipProvider delayDuration={0}>
        <div className={`border-l bg-card flex flex-col transition-all duration-200 ${rightCollapsed ? 'w-14' : 'w-72'}`}>
          {/* Toggle + Project selector */}
          <div className={`border-b ${rightCollapsed ? 'p-2' : 'p-4 space-y-3'}`}>
            {rightCollapsed ? (
              <div className="flex flex-col items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { setRightCollapsed(false); localStorage.setItem('cos-agents-sidebar', 'false') }}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                    >
                      <PanelRightOpen className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Expandir panel</TooltipContent>
                </Tooltip>
                {selectedProyecto && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {selectedProyecto.nombre.slice(0, 2).toUpperCase()}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="font-medium">{selectedProyecto.nombre}</p>
                      {selectedProyecto.paises && <p className="text-xs opacity-70">{selectedProyecto.paises.nombre}</p>}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proyecto</h3>
                  <button
                    onClick={() => { setRightCollapsed(true); localStorage.setItem('cos-agents-sidebar', 'true') }}
                    className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <PanelRightClose className="w-4 h-4" />
                  </button>
                </div>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedProyecto?.id || ''}
                  onChange={e => {
                    const p = proyectos.find(p => p.id === e.target.value)
                    setSelectedProyecto(p || null)
                    setQuickPrompt(null)
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
              </>
            )}
          </div>

          {/* Agent selector */}
          <div className={`flex-1 overflow-y-auto space-y-1 ${rightCollapsed ? 'p-1.5' : 'p-3'}`}>
            {!rightCollapsed && (
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                Agentes activos ({availableAgents.length})
              </h3>
            )}
            {availableAgents.map(ag => {
              const Icon = ag.icono
              const isActive = selectedAgente === ag.id

              if (rightCollapsed) {
                return (
                  <Tooltip key={ag.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => { setSelectedAgente(ag.id); setQuickPrompt(null) }}
                        className={`w-full flex items-center justify-center p-2 rounded-lg transition-all ${
                          isActive
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-muted border border-transparent'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ag.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="font-medium">{ag.nombre}</p>
                      <p className="text-xs opacity-70">{ag.desc}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              }

              const modelShort = ag.model.split('/').pop() || ag.model
              return (
                <button
                  key={ag.id}
                  onClick={() => { setSelectedAgente(ag.id); setQuickPrompt(null) }}
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
                    <p className="text-[10px] text-muted-foreground truncate">{modelShort}</p>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                </button>
              )
            })}

            {/* Show unconfigured agents */}
            {!rightCollapsed && Object.keys(AGENT_META).filter(slug => !agentConfig[slug]?.isCustom).length > 0 && (
              <>
                <div className="pt-3 pb-1">
                  <h3 className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider px-1">
                    Sin configurar
                  </h3>
                </div>
                {Object.entries(AGENT_META)
                  .filter(([slug]) => !agentConfig[slug]?.isCustom)
                  .map(([slug, ag]) => {
                    const Icon = ag.icono
                    return (
                      <div
                        key={slug}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg opacity-40"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{ag.nombre}</p>
                          <p className="text-[10px] text-muted-foreground">No configurado</p>
                        </div>
                      </div>
                    )
                  })}
              </>
            )}
            {rightCollapsed && Object.entries(AGENT_META)
              .filter(([slug]) => !agentConfig[slug]?.isCustom)
              .map(([slug, ag]) => {
                const Icon = ag.icono
                return (
                  <Tooltip key={slug}>
                    <TooltipTrigger asChild>
                      <div className="w-full flex items-center justify-center p-2 rounded-lg opacity-30">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-muted">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>{ag.nombre}</p>
                      <p className="text-xs opacity-70">No configurado</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
          </div>

          {/* Agent info + config link */}
          <div className={`border-t ${rightCollapsed ? 'p-1.5' : 'p-3 space-y-2'}`}>
            {!rightCollapsed && currentAgent && currentConfig && (
              <div className="p-2.5 rounded-lg bg-muted/50 space-y-1.5">
                <p className="text-[11px] font-medium">{currentAgent.nombre}</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{currentAgent.rol}</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                    {currentConfig.provider}
                  </Badge>
                  <span className="text-[9px] text-muted-foreground truncate">
                    {currentConfig.model.split('/').pop()}
                  </span>
                </div>
              </div>
            )}
            {rightCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/dashboard/configuracion" className="block">
                    <Button variant="ghost" size="icon" className="w-full h-9 text-muted-foreground">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="left">Configurar agentes</TooltipContent>
              </Tooltip>
            ) : (
              <Link href="/dashboard/configuracion" className="block">
                <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs text-muted-foreground">
                  <Settings className="w-3 h-3" />
                  Configurar agentes
                </Button>
              </Link>
            )}
          </div>
        </div>
      </TooltipProvider>
    </div>
  )
}

// ============================================================
// Orchestration Panel Component
// ============================================================

function OrchestrationPanel({ compact }: { compact?: boolean }) {
  const agents = [
    { slug: 'normativa', label: 'Normativa', color: 'border-blue-300 bg-blue-50', icon: Scale, action: 'Valida normativas' },
    { slug: 'metrados', label: 'Metrados', color: 'border-green-300 bg-green-50', icon: Calculator, action: 'Calcula cantidades' },
    { slug: 'partidas', label: 'Partidas APU', color: 'border-amber-300 bg-amber-50', icon: Layers, action: 'Desglosa componentes' },
    { slug: 'presupuesto', label: 'Presupuesto', color: 'border-emerald-300 bg-emerald-50', icon: DollarSign, action: 'Estructura costos' },
    { slug: 'bim', label: 'BIM/Revit', color: 'border-indigo-300 bg-indigo-50', icon: Box, action: 'Mapea BIM → partidas' },
  ]

  if (compact) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-600" />
          Orquestacion de agentes
        </h4>
        <div className="grid grid-cols-5 gap-2">
          {agents.map(ag => {
            const Icon = ag.icon
            return (
              <div key={ag.slug} className={`rounded-lg border p-2 text-center ${ag.color}`}>
                <Icon className="w-4 h-4 mx-auto mb-1" />
                <p className="text-[10px] font-medium">{ag.label}</p>
                <p className="text-[9px] text-muted-foreground">{ag.action}</p>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowRight className="w-3 h-3" />
          <span>El Orquestador recibe tu consulta, activa los agentes necesarios, y sintetiza la respuesta</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-lg">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <Brain className="w-5 h-5 text-violet-600" />
        Como se orquestan los agentes
      </h3>

      <div className="space-y-3">
        {/* Orquestador */}
        <Card className="border-violet-200 bg-violet-50/50">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <Brain className="w-5 h-5 text-violet-600" />
              <div>
                <p className="text-sm font-semibold text-violet-800">Orquestador</p>
                <p className="text-xs text-violet-600">
                  Recibe tu consulta → Decide que agentes activar → Sintetiza la respuesta
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
        </div>

        {/* Specialist agents */}
        <div className="grid grid-cols-1 gap-2">
          {agents.map(ag => {
            const Icon = ag.icon
            return (
              <div key={ag.slug} className={`rounded-lg border p-3 flex items-center gap-3 ${ag.color}`}>
                <Icon className="w-4 h-4 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">{ag.label}</p>
                  <p className="text-[10px] text-muted-foreground">{ag.action}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
        </div>

        {/* Project */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 px-4">
            <p className="text-sm font-semibold">Proyecto</p>
            <p className="text-xs text-muted-foreground">
              Analisis de partidas, sugerencias, validacion de metrados y normativa
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
