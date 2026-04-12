'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Key, Plus, Trash2, Check, Loader2, Eye, EyeOff, Shield, ExternalLink,
  Cpu, Building2, Users, UserPlus, Bot, RotateCcw, Save, Pencil, X,
  Zap, CircleCheck, CircleX, Globe,
} from 'lucide-react'

// ============================================================
// Types
// ============================================================

interface ProviderModelItem {
  id: string
  provider: string
  model_id: string
  model_name: string
  context_window: number
  activo: boolean
  orden: number
}

interface ProviderInfo {
  id: string; name: string; description: string; keyId?: string;
  maskedKey?: string; label?: string; models?: { id: string; name: string; contextWindow?: number }[];
  supportsModelFetch?: boolean
}
interface AllProvider { id: string; name: string; description: string; baseURL?: string }
interface OrgData { id: string; nombre: string; slug: string | null; plan: string | null; created_at: string }
interface MemberData {
  id: string; user_id: string; email: string; rol: string;
  created_at: string; is_current: boolean
}
interface AgentConfigItem { provider: string; model: string; isCustom: boolean }

const PROVIDER_LINKS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/keys',
  openai: 'https://platform.openai.com/api-keys',
  gemini: 'https://aistudio.google.com/apikey',
  anthropic: 'https://console.anthropic.com/settings/keys',
  huggingface: 'https://huggingface.co/settings/tokens',
}

const PROVIDER_PREFIXES: Record<string, string> = {
  openrouter: 'sk-or-...', openai: 'sk-...', gemini: 'AIza...',
  anthropic: 'sk-ant-...', huggingface: 'hf_...',
}

const AGENT_LABELS: Record<string, string> = {
  orquestador: 'Orquestador', normativa: 'Normativa', metrados: 'Metrados',
  partidas: 'Partidas APU', presupuesto: 'Presupuesto', bim: 'BIM/Revit',
}

const AGENT_DESCRIPTIONS: Record<string, string> = {
  orquestador: 'Coordina agentes, prioriza tareas',
  normativa: 'Experto en NB, RNE, ABNT, CSI',
  metrados: 'Cantidades, volumenes, BIM',
  partidas: 'Desglose materiales + MO + equipos',
  presupuesto: 'CD + GG + utilidad + impuestos',
  bim: 'Categorias Revit 2025 → partidas',
}

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'miembro', label: 'Miembro' },
  { value: 'viewer', label: 'Visor' },
]

// ============================================================
// Component
// ============================================================

export default function ConfiguracionPage() {
  const [activeTab, setActiveTab] = useState<'empresa' | 'llm' | 'agentes'>('empresa')

  // --- LLM State ---
  const [configuredProviders, setConfiguredProviders] = useState<ProviderInfo[]>([])
  const [allProviders, setAllProviders] = useState<AllProvider[]>([])
  const [isLoadingLLM, setIsLoadingLLM] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addProvider, setAddProvider] = useState('')
  const [addKey, setAddKey] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)

  // --- Provider Models State ---
  const [providerModels, setProviderModels] = useState<ProviderModelItem[]>([])
  const [showAddModel, setShowAddModel] = useState<string | null>(null) // provider id
  const [newModelId, setNewModelId] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [newModelCtx, setNewModelCtx] = useState('')
  const [addingModel, setAddingModel] = useState(false)

  // --- Org State ---
  const [org, setOrg] = useState<OrgData | null>(null)
  const [members, setMembers] = useState<MemberData[]>([])
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isLoadingOrg, setIsLoadingOrg] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [editingOrg, setEditingOrg] = useState(false)
  const [savingOrg, setSavingOrg] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('miembro')
  const [showInvite, setShowInvite] = useState(false)
  const [inviting, setInviting] = useState(false)

  // --- Agent Config State ---
  const [agentConfig, setAgentConfig] = useState<Record<string, AgentConfigItem>>({})
  const [isLoadingAgents, setIsLoadingAgents] = useState(true)
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [agentProvider, setAgentProvider] = useState('')
  const [agentModel, setAgentModel] = useState('')
  const [savingAgent, setSavingAgent] = useState(false)
  const [testingAgent, setTestingAgent] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; latency?: number; error?: string }>>({})

  // ============================================================
  // Fetch functions
  // ============================================================

  const fetchLLMConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config/llm')
      if (res.ok) {
        const data = await res.json()
        setConfiguredProviders(data.providers || [])
        setAllProviders(data.allProviders || [])
      }
    } catch (err) { console.error('Error fetching LLM config:', err) }
    finally { setIsLoadingLLM(false) }
  }, [])

  const fetchProviderModels = useCallback(async () => {
    try {
      const res = await fetch('/api/config/llm/provider-models')
      if (res.ok) {
        const data = await res.json()
        setProviderModels(data.models || [])
      }
    } catch (err) { console.error('Error fetching provider models:', err) }
  }, [])

  const fetchOrg = useCallback(async () => {
    try {
      const res = await fetch('/api/organizacion')
      if (res.ok) {
        const data = await res.json()
        setOrg(data.org)
        setMembers(data.members || [])
        setUserRole(data.userRole)
        if (data.org) setOrgName(data.org.nombre)
      }
    } catch (err) { console.error('Error fetching org:', err) }
    finally { setIsLoadingOrg(false) }
  }, [])

  const fetchAgentConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config/agentes')
      if (res.ok) {
        const data = await res.json()
        setAgentConfig(data.config || {})
      }
    } catch (err) { console.error('Error fetching agent config:', err) }
    finally { setIsLoadingAgents(false) }
  }, [])

  useEffect(() => {
    fetchLLMConfig()
    fetchOrg()
    fetchAgentConfig()
    fetchProviderModels()
  }, [fetchLLMConfig, fetchOrg, fetchAgentConfig, fetchProviderModels])

  // ============================================================
  // Get models for a provider (from DB provider_models, fallback to static)
  // ============================================================

  const getModelsForProvider = useCallback((providerId: string) => {
    const dbModels = providerModels.filter(m => m.provider === providerId)
    if (dbModels.length > 0) {
      return dbModels.map(m => ({ id: m.model_id, name: m.model_name, contextWindow: m.context_window }))
    }
    // Fallback: use static models from configuredProviders
    const prov = configuredProviders.find(p => p.id === providerId)
    return prov?.models || []
  }, [providerModels, configuredProviders])

  // ============================================================
  // LLM handlers
  // ============================================================

  const toggleExpanded = (providerId: string) => {
    setExpandedProvider(expandedProvider === providerId ? null : providerId)
  }

  const handleAddKey = async () => {
    if (!addProvider || !addKey.trim()) return
    setSaving(addProvider); setMessage(null)
    try {
      const res = await fetch('/api/config/llm/keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: addProvider, api_key: addKey.trim(), label: addLabel.trim() || undefined }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al guardar') }
      setMessage({ type: 'success', text: `Key de ${addProvider} guardada correctamente` })
      setAddKey(''); setAddLabel(''); setShowAddForm(false)
      await fetchLLMConfig()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar' })
    } finally { setSaving(null) }
  }

  const handleDeleteKey = async (provider: string, keyId?: string) => {
    if (!confirm('Eliminar esta API key?')) return
    setDeleting(provider)
    try {
      const params = keyId ? `id=${keyId}` : `provider=${provider}`
      const res = await fetch(`/api/config/llm/keys?${params}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setMessage({ type: 'success', text: 'Key eliminada' })
      await fetchLLMConfig()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al eliminar' })
    } finally { setDeleting(null) }
  }

  // ============================================================
  // Provider Models handlers
  // ============================================================

  const handleAddModel = async (providerId: string) => {
    if (!newModelId.trim() || !newModelName.trim()) return
    setAddingModel(true); setMessage(null)
    try {
      const res = await fetch('/api/config/llm/provider-models', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          model_id: newModelId.trim(),
          model_name: newModelName.trim(),
          context_window: parseInt(newModelCtx) || 0,
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error') }
      setMessage({ type: 'success', text: `Modelo ${newModelName} agregado` })
      setNewModelId(''); setNewModelName(''); setNewModelCtx(''); setShowAddModel(null)
      await fetchProviderModels()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error' })
    } finally { setAddingModel(false) }
  }

  const handleDeleteModel = async (modelDbId: string) => {
    try {
      const res = await fetch(`/api/config/llm/provider-models?id=${modelDbId}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      await fetchProviderModels()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error' })
    }
  }

  // ============================================================
  // Org handlers
  // ============================================================

  const handleCreateOrg = async () => {
    if (!orgName.trim()) return
    setSavingOrg(true); setMessage(null)
    try {
      const res = await fetch('/api/organizacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: orgName.trim() }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setMessage({ type: 'success', text: 'Organizacion creada' })
      await fetchOrg()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error' })
    } finally { setSavingOrg(false) }
  }

  const handleUpdateOrg = async () => {
    if (!orgName.trim()) return
    setSavingOrg(true); setMessage(null)
    try {
      const res = await fetch('/api/organizacion', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: orgName.trim() }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setMessage({ type: 'success', text: 'Organizacion actualizada' })
      setEditingOrg(false)
      await fetchOrg()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error' })
    } finally { setSavingOrg(false) }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true); setMessage(null)
    try {
      const res = await fetch('/api/organizacion/miembros', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), rol: inviteRole }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setMessage({ type: 'success', text: `${inviteEmail} agregado como ${inviteRole}` })
      setInviteEmail(''); setShowInvite(false)
      await fetchOrg()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error' })
    } finally { setInviting(false) }
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch('/api/organizacion/miembros', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, rol: newRole }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      await fetchOrg()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error' })
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remover este miembro?')) return
    try {
      const res = await fetch(`/api/organizacion/miembros?id=${memberId}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      await fetchOrg()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error' })
    }
  }

  // ============================================================
  // Agent config handlers
  // ============================================================

  const startEditAgent = (slug: string) => {
    const cfg = agentConfig[slug]
    if (cfg) {
      setAgentProvider(cfg.provider)
      setAgentModel(cfg.model)
    }
    setEditingAgent(slug)
  }

  const handleProviderChangeForAgent = (providerId: string) => {
    setAgentProvider(providerId)
    // Auto-select first model of this provider
    const models = getModelsForProvider(providerId)
    if (models.length > 0) {
      setAgentModel(models[0].id)
    } else {
      setAgentModel('')
    }
  }

  const handleSaveAgent = async (slug: string) => {
    if (!agentProvider || !agentModel) return
    setSavingAgent(true); setMessage(null)
    try {
      const res = await fetch('/api/config/agentes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_slug: slug, provider: agentProvider, model: agentModel }),
      })
      const data = await res.json()
      if (!res.ok) { throw new Error(data.error || 'Error al guardar') }
      setMessage({ type: 'success', text: `Modelo de ${AGENT_LABELS[slug]} actualizado` })
      setEditingAgent(null)
      await fetchAgentConfig()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar agente' })
    } finally { setSavingAgent(false) }
  }

  const handleResetAgent = async (slug: string) => {
    try {
      const res = await fetch(`/api/config/agentes?slug=${slug}`, { method: 'DELETE' })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setMessage({ type: 'success', text: `${AGENT_LABELS[slug]} restaurado a default` })
      setTestResult(prev => { const next = { ...prev }; delete next[slug]; return next })
      await fetchAgentConfig()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error' })
    }
  }

  const handleTestConnection = async (slug: string, provider: string, model: string) => {
    setTestingAgent(slug)
    setTestResult(prev => { const next = { ...prev }; delete next[slug]; return next })
    try {
      const res = await fetch('/api/config/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model }),
      })
      const data = await res.json()
      setTestResult(prev => ({ ...prev, [slug]: data }))
    } catch (err) {
      setTestResult(prev => ({
        ...prev,
        [slug]: { ok: false, error: err instanceof Error ? err.message : 'Error de red' },
      }))
    } finally {
      setTestingAgent(null)
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  // Get all available providers for the agent dropdown (configured + env + openrouter fallback)
  const getAvailableProviders = useCallback(() => {
    const provIds = new Set<string>()
    const result: { id: string; name: string }[] = []

    for (const p of configuredProviders) {
      if (!provIds.has(p.id)) {
        provIds.add(p.id)
        result.push({ id: p.id, name: p.name })
      }
    }

    // Always include openrouter as fallback
    if (!provIds.has('openrouter')) {
      result.push({ id: 'openrouter', name: 'OpenRouter (default)' })
    }

    return result
  }, [configuredProviders])

  // Get model name for display
  const getModelDisplayName = useCallback((provider: string, modelId: string) => {
    const models = getModelsForProvider(provider)
    const found = models.find(m => m.id === modelId)
    return found?.name || modelId
  }, [getModelsForProvider])

  // ============================================================
  // Render
  // ============================================================

  const isAdmin = userRole === 'admin'
  const tabs = [
    { id: 'empresa' as const, label: 'Empresa', icon: Building2 },
    { id: 'llm' as const, label: 'API Keys', icon: Key },
    { id: 'agentes' as const, label: 'Modelos IA', icon: Bot },
  ]

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Configuracion</h1>
        <p className="text-muted-foreground mt-1">Empresa, API keys y modelos de IA</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setMessage(null) }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Status message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
          'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: Empresa */}
      {/* ============================================================ */}
      {activeTab === 'empresa' && (
        <div className="space-y-6">
          {isLoadingOrg ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !org ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" /> Crear organizacion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Crea una organizacion para invitar miembros y compartir proyectos.
                </p>
                <div className="space-y-2">
                  <Label>Nombre de la empresa</Label>
                  <Input placeholder="Ej: SSA Ingenieria SRL" value={orgName} onChange={e => setOrgName(e.target.value)} />
                </div>
                <Button onClick={handleCreateOrg} disabled={!orgName.trim() || savingOrg}>
                  {savingOrg ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Crear organizacion
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" /> {org.nombre}
                    </CardTitle>
                    {isAdmin && !editingOrg && (
                      <Button variant="ghost" size="sm" onClick={() => setEditingOrg(true)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {editingOrg && (
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input value={orgName} onChange={e => setOrgName(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleUpdateOrg} disabled={savingOrg || !orgName.trim()} size="sm">
                        {savingOrg ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                        Guardar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setEditingOrg(false); setOrgName(org.nombre) }}>
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                )}
                {!editingOrg && (
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Plan:</span>{' '}
                        <Badge variant="secondary">{org.plan || 'free'}</Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Miembros:</span>{' '}
                        <span className="font-medium">{members.length}</span>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Members */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="w-5 h-5" /> Miembros ({members.length})
                    </CardTitle>
                    {isAdmin && !showInvite && (
                      <Button size="sm" onClick={() => setShowInvite(true)} className="gap-1">
                        <UserPlus className="w-4 h-4" /> Invitar
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {showInvite && (
                    <div className="p-4 rounded-lg border border-primary/30 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs">Email del usuario</Label>
                          <Input type="email" placeholder="usuario@empresa.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Rol</Label>
                          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">El usuario debe estar registrado en la plataforma.</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                          {inviting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                          Agregar
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setShowInvite(false); setInviteEmail('') }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}

                  {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{m.email}</span>
                          {m.is_current && <Badge variant="outline" className="text-xs">Tu</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          {isAdmin && !m.is_current ? (
                            <select className="h-7 rounded border border-input bg-background px-2 text-xs"
                              value={m.rol} onChange={e => handleChangeRole(m.id, e.target.value)}>
                              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              {ROLES.find(r => r.value === m.rol)?.label || m.rol}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {isAdmin && !m.is_current && (
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(m.id)}
                          className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: API Keys + Models */}
      {/* ============================================================ */}
      {activeTab === 'llm' && (
        <div className="space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
            <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Tus keys estan encriptadas</p>
              <p className="text-muted-foreground mt-1">
                Las API keys se almacenan con cifrado AES-256-GCM. Cada usuario gestiona sus propias keys.
              </p>
            </div>
          </div>

          {isLoadingLLM ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Configured providers */}
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Proveedores configurados</h2>
                {configuredProviders.length === 0 ? (
                  <Card className="p-8">
                    <div className="text-center space-y-3">
                      <Key className="w-10 h-10 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No tienes API keys configuradas. Agrega una para empezar a usar los agentes IA.
                      </p>
                    </div>
                  </Card>
                ) : (
                  configuredProviders.map(p => {
                    const provModels = providerModels.filter(m => m.provider === p.id)
                    const isExpanded = expandedProvider === p.id

                    return (
                      <Card key={p.id}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{p.name}</span>
                                <Badge variant="outline" className="text-xs">{p.maskedKey}</Badge>
                                {p.label && <Badge variant="secondary" className="text-xs">{p.label}</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground">{p.description}</p>
                              {(() => {
                                const provInfo = allProviders.find(ap => ap.id === p.id)
                                return provInfo?.baseURL ? (
                                  <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                                    <Globe className="w-3 h-3" /> {provInfo.baseURL}
                                  </p>
                                ) : null
                              })()}
                              <button onClick={() => toggleExpanded(p.id)}
                                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                                <Cpu className="w-3 h-3" />
                                {provModels.length || p.models?.length || 0} modelo{(provModels.length || p.models?.length || 0) !== 1 ? 's' : ''} disponibles
                              </button>

                              {/* Expanded model list */}
                              {isExpanded && (
                                <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-1">
                                  {provModels.length > 0 ? (
                                    provModels.map(m => (
                                      <div key={m.id} className="flex justify-between items-center text-xs py-1.5 border-b last:border-0">
                                        <div>
                                          <span className="font-medium">{m.model_name}</span>
                                          <span className="text-muted-foreground font-mono ml-2">{m.model_id}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {m.context_window > 0 && (
                                            <span className="text-muted-foreground">{(m.context_window / 1000).toFixed(0)}K</span>
                                          )}
                                          <button onClick={() => handleDeleteModel(m.id)}
                                            className="text-muted-foreground hover:text-destructive">
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    p.models?.map(m => (
                                      <div key={m.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                                        <span className="font-medium">{m.name}</span>
                                        <span className="text-muted-foreground font-mono">{m.id}</span>
                                      </div>
                                    ))
                                  )}

                                  {/* Add model form */}
                                  {showAddModel === p.id ? (
                                    <div className="mt-2 pt-2 border-t space-y-2">
                                      <div className="grid grid-cols-3 gap-2">
                                        <Input className="h-7 text-xs" placeholder="model-id"
                                          value={newModelId} onChange={e => setNewModelId(e.target.value)} />
                                        <Input className="h-7 text-xs" placeholder="Nombre visible"
                                          value={newModelName} onChange={e => setNewModelName(e.target.value)} />
                                        <Input className="h-7 text-xs" placeholder="Context (tokens)"
                                          value={newModelCtx} onChange={e => setNewModelCtx(e.target.value)} />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button size="sm" className="h-7 text-xs" onClick={() => handleAddModel(p.id)}
                                          disabled={addingModel || !newModelId.trim() || !newModelName.trim()}>
                                          {addingModel ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                                          Agregar
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-7 text-xs"
                                          onClick={() => { setShowAddModel(null); setNewModelId(''); setNewModelName(''); setNewModelCtx('') }}>
                                          Cancelar
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button onClick={() => setShowAddModel(p.id)}
                                      className="flex items-center gap-1 text-xs text-primary hover:underline mt-2 pt-2 border-t w-full">
                                      <Plus className="w-3 h-3" /> Agregar modelo
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-emerald-500" />
                              {p.keyId && (
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteKey(p.id, p.keyId)}
                                  disabled={deleting === p.id} className="text-destructive hover:text-destructive">
                                  {deleting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>

              {/* Available services */}
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Servicios de IA disponibles</h2>
                <div className="grid gap-2">
                  {allProviders.map(p => {
                    const isConfigured = configuredProviders.some(cp => cp.id === p.id)
                    return (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p.name}</span>
                            {isConfigured && <Badge variant="secondary" className="text-[10px]">configurado</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                          {p.baseURL && (
                            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                              <Globe className="w-3 h-3 flex-shrink-0" /> {p.baseURL}
                            </p>
                          )}
                        </div>
                        {PROVIDER_LINKS[p.id] && (
                          <a href={PROVIDER_LINKS[p.id]} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0 ml-3">
                            Obtener key <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Add key form */}
              {!showAddForm ? (
                <Button onClick={() => { setShowAddForm(true); setAddProvider(allProviders[0]?.id || 'openrouter') }} className="gap-2">
                  <Plus className="w-4 h-4" /> Agregar proveedor
                </Button>
              ) : (
                <Card className="border-primary/30">
                  <CardHeader className="pb-3"><CardTitle className="text-base">Agregar API Key</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Proveedor</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={addProvider} onChange={e => setAddProvider(e.target.value)}>
                          {allProviders.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} {configuredProviders.find(c => c.id === p.id) ? '(actualizar)' : ''}
                            </option>
                          ))}
                        </select>
                        {addProvider && PROVIDER_LINKS[addProvider] && (
                          <a href={PROVIDER_LINKS[addProvider]} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1">
                            Obtener key <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Etiqueta (opcional)</Label>
                        <Input placeholder="Ej: Cuenta personal" value={addLabel} onChange={e => setAddLabel(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <div className="relative">
                        <Input type={showKey ? 'text' : 'password'}
                          placeholder={PROVIDER_PREFIXES[addProvider] || 'Pega tu API key aqui'}
                          value={addKey} onChange={e => setAddKey(e.target.value)} className="pr-10" />
                        <Button type="button" variant="ghost" size="sm"
                          className="absolute right-1 top-1 h-8 w-8 p-0" onClick={() => setShowKey(!showKey)}>
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleAddKey} disabled={!addKey.trim() || !addProvider || saving !== null}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Guardar key
                      </Button>
                      <Button variant="outline" onClick={() => { setShowAddForm(false); setAddKey(''); setAddLabel('') }}>
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: Modelos IA por Agente */}
      {/* ============================================================ */}
      {activeTab === 'agentes' && (
        <div className="space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
            <Bot className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Modelo por defecto de cada agente</p>
              <p className="text-muted-foreground mt-1">
                Configura que proveedor y modelo usa cada agente. Selecciona de la lista de modelos disponibles
                o agrega nuevos modelos en la tab &quot;API Keys&quot;.
              </p>
            </div>
          </div>

          {isLoadingAgents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(agentConfig).map(([slug, cfg]) => {
                const availableProviders = getAvailableProviders()
                const currentModels = getModelsForProvider(editingAgent === slug ? agentProvider : cfg.provider)

                return (
                  <Card key={slug}>
                    <CardContent className="py-4">
                      {editingAgent === slug ? (
                        /* Edit mode */
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">{AGENT_LABELS[slug] || slug}</span>
                              <span className="text-xs text-muted-foreground ml-2">{AGENT_DESCRIPTIONS[slug]}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setEditingAgent(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Proveedor</Label>
                              <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                                value={agentProvider} onChange={e => handleProviderChangeForAgent(e.target.value)}>
                                {availableProviders.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Modelo</Label>
                              {currentModels.length > 0 ? (
                                <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                                  value={agentModel} onChange={e => setAgentModel(e.target.value)}>
                                  {currentModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                  {/* If current model is not in the list, show it as custom */}
                                  {agentModel && !currentModels.find(m => m.id === agentModel) && (
                                    <option value={agentModel}>{agentModel} (personalizado)</option>
                                  )}
                                </select>
                              ) : (
                                <Input className="h-9 text-sm" value={agentModel}
                                  onChange={e => setAgentModel(e.target.value)}
                                  placeholder="model-id" />
                              )}
                            </div>
                          </div>
                          {currentModels.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                const m = currentModels.find(m => m.id === agentModel)
                                return m?.contextWindow ? `Contexto: ${(m.contextWindow / 1000).toFixed(0)}K tokens` : ''
                              })()}
                            </p>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleSaveAgent(slug)} disabled={savingAgent || !agentModel}>
                              {savingAgent ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                              Guardar
                            </Button>
                            <Button variant="outline" size="sm"
                              onClick={() => handleTestConnection(slug, agentProvider, agentModel)}
                              disabled={testingAgent === slug || !agentProvider || !agentModel}>
                              {testingAgent === slug
                                ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                : <Zap className="w-4 h-4 mr-1" />}
                              Test
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setEditingAgent(null)}>Cancelar</Button>
                          </div>
                          {testResult[slug] && (
                            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                              testResult[slug].ok
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {testResult[slug].ok ? (
                                <>
                                  <CircleCheck className="w-3.5 h-3.5" />
                                  <span>Conexion OK</span>
                                  {testResult[slug].latency && <span className="text-muted-foreground">({testResult[slug].latency}ms)</span>}
                                </>
                              ) : (
                                <>
                                  <CircleX className="w-3.5 h-3.5" />
                                  <span>{testResult[slug].error || 'Error de conexion'}</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* View mode */
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{AGENT_LABELS[slug] || slug}</span>
                                {cfg.isCustom && <Badge variant="secondary" className="text-xs">personalizado</Badge>}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium">{cfg.provider}</span>
                                <span>/</span>
                                <span className="font-mono">{getModelDisplayName(cfg.provider, cfg.model)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{AGENT_DESCRIPTIONS[slug]}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm"
                                onClick={() => handleTestConnection(slug, cfg.provider, cfg.model)}
                                disabled={testingAgent === slug} title="Probar conexion">
                                {testingAgent === slug ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => startEditAgent(slug)} title="Editar">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {cfg.isCustom && (
                                <Button variant="ghost" size="sm" onClick={() => handleResetAgent(slug)}
                                  title="Restaurar default" className="text-muted-foreground">
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          {testResult[slug] && (
                            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                              testResult[slug].ok
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {testResult[slug].ok ? (
                                <>
                                  <CircleCheck className="w-3.5 h-3.5" />
                                  <span>Conexion exitosa</span>
                                  {testResult[slug].latency && <span className="text-muted-foreground">({testResult[slug].latency}ms)</span>}
                                </>
                              ) : (
                                <>
                                  <CircleX className="w-3.5 h-3.5" />
                                  <span>{testResult[slug].error || 'Error de conexion'}</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Quick guide */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Modelos recomendados</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">google/gemini-2.0-flash</span> — rapido y economico (~$0.10/M tokens). Ideal para metrados, partidas, presupuesto.</p>
              <p><span className="font-medium text-foreground">google/gemini-2.5-flash-preview</span> — mejor razonamiento (~$0.15/M). Recomendado para normativa y BIM.</p>
              <p><span className="font-medium text-foreground">anthropic/claude-sonnet-4</span> — alta calidad. Para consultas complejas del orquestador.</p>
              <p><span className="font-medium text-foreground">openai/gpt-4o-mini</span> — alternativa economica de OpenAI.</p>
              <p className="pt-2 text-xs border-t">Para agregar o quitar modelos de la lista, ve a la tab &quot;API Keys&quot; y expande el proveedor.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
