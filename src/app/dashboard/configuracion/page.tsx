'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Key, Plus, Trash2, Check, Loader2, Eye, EyeOff, Shield, ExternalLink, Cpu } from 'lucide-react'

interface ModelInfo {
  id: string
  name: string
  contextWindow?: number
}

interface ProviderInfo {
  id: string
  name: string
  description: string
  keyId?: string
  maskedKey?: string
  label?: string
  models?: ModelInfo[]
  supportsModelFetch?: boolean
}

interface AllProvider {
  id: string
  name: string
  description: string
}

const PROVIDER_LINKS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/keys',
  openai: 'https://platform.openai.com/api-keys',
  gemini: 'https://aistudio.google.com/apikey',
  anthropic: 'https://console.anthropic.com/settings/keys',
  huggingface: 'https://huggingface.co/settings/tokens',
}

const PROVIDER_PREFIXES: Record<string, string> = {
  openrouter: 'sk-or-...',
  openai: 'sk-...',
  gemini: 'AIza...',
  anthropic: 'sk-ant-...',
  huggingface: 'hf_...',
}

const PROVIDER_ENDPOINTS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  anthropic: 'https://api.anthropic.com',
  huggingface: 'https://router.huggingface.co/v1',
}

export default function ConfiguracionPage() {
  const [configuredProviders, setConfiguredProviders] = useState<ProviderInfo[]>([])
  const [allProviders, setAllProviders] = useState<AllProvider[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addProvider, setAddProvider] = useState('')
  const [addKey, setAddKey] = useState('')
  const [addLabel, setAddLabel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Dynamic model loading for OpenRouter
  const [dynamicModels, setDynamicModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config/llm')
      if (res.ok) {
        const data = await res.json()
        setConfiguredProviders(data.providers || [])
        setAllProviders(data.allProviders || [])
      }
    } catch (err) {
      console.error('Error fetching config:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const fetchDynamicModels = async (providerId: string) => {
    setLoadingModels(true)
    try {
      const res = await fetch(`/api/config/llm/models?provider=${providerId}`)
      if (res.ok) {
        const data = await res.json()
        setDynamicModels(data.models || [])
      }
    } catch (err) {
      console.error('Error fetching models:', err)
    } finally {
      setLoadingModels(false)
    }
  }

  const toggleExpanded = (providerId: string) => {
    if (expandedProvider === providerId) {
      setExpandedProvider(null)
    } else {
      setExpandedProvider(providerId)
      const prov = configuredProviders.find(p => p.id === providerId)
      if (prov?.supportsModelFetch) {
        fetchDynamicModels(providerId)
      }
    }
  }

  const handleAdd = async () => {
    if (!addProvider || !addKey.trim()) return
    setSaving(addProvider)
    setMessage(null)

    try {
      const res = await fetch('/api/config/llm/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: addProvider,
          api_key: addKey.trim(),
          label: addLabel.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }

      setMessage({ type: 'success', text: `Key de ${addProvider} guardada correctamente` })
      setAddKey('')
      setAddLabel('')
      setShowAddForm(false)
      await fetchConfig()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al guardar' })
    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async (provider: string, keyId?: string) => {
    if (!confirm('¿Eliminar esta API key?')) return
    setDeleting(provider)

    try {
      const params = keyId ? `id=${keyId}` : `provider=${provider}`
      const res = await fetch(`/api/config/llm/keys?${params}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error)
      }
      setMessage({ type: 'success', text: 'Key eliminada' })
      await fetchConfig()
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al eliminar' })
    } finally {
      setDeleting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tus API keys y modelos de IA para los agentes
        </p>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
        <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Tus keys están encriptadas</p>
          <p className="text-muted-foreground mt-1">
            Las API keys se almacenan con cifrado AES-256-GCM. Cada usuario gestiona sus propias keys.
          </p>
        </div>
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
          configuredProviders.map(p => (
            <Card key={p.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="outline" className="text-xs">{p.maskedKey}</Badge>
                      {p.label && (
                        <Badge variant="secondary" className="text-xs">{p.label}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>

                    {/* Endpoint info */}
                    <p className="text-xs text-muted-foreground font-mono">
                      Endpoint: {PROVIDER_ENDPOINTS[p.id] || 'default'}
                    </p>

                    {/* Models */}
                    {p.models && p.models.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => toggleExpanded(p.id)}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Cpu className="w-3 h-3" />
                          {p.models.length} modelo{p.models.length !== 1 ? 's' : ''} disponible{p.models.length !== 1 ? 's' : ''}
                          {p.supportsModelFetch && ' (click para ver dinámicos)'}
                        </button>

                        {expandedProvider === p.id && (
                          <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-1 max-h-60 overflow-y-auto">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Modelos disponibles — selecciona desde el chat del agente:
                            </p>
                            {/* Static models */}
                            {p.models.map(m => (
                              <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-muted last:border-0">
                                <span className="font-medium">{m.name}</span>
                                <span className="text-muted-foreground font-mono">{m.id}</span>
                              </div>
                            ))}

                            {/* Dynamic models (OpenRouter) */}
                            {loadingModels && (
                              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                <Loader2 className="w-3 h-3 animate-spin" /> Cargando modelos dinámicos...
                              </div>
                            )}
                            {!loadingModels && dynamicModels.length > 0 && (
                              <>
                                <p className="text-xs font-medium text-primary mt-3 mb-1">
                                  + {dynamicModels.length} modelos dinámicos de OpenRouter:
                                </p>
                                {dynamicModels.slice(0, 50).map(m => (
                                  <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-muted last:border-0">
                                    <span>{m.name}</span>
                                    <span className="text-muted-foreground font-mono text-[10px]">{m.id}</span>
                                  </div>
                                ))}
                                {dynamicModels.length > 50 && (
                                  <p className="text-xs text-muted-foreground py-1">
                                    ... y {dynamicModels.length - 50} más
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    {p.keyId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(p.id, p.keyId)}
                        disabled={deleting === p.id}
                        className="text-destructive hover:text-destructive"
                      >
                        {deleting === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add new provider */}
      {!showAddForm ? (
        <Button onClick={() => { setShowAddForm(true); setAddProvider(allProviders[0]?.id || 'openrouter') }} className="gap-2">
          <Plus className="w-4 h-4" />
          Agregar proveedor
        </Button>
      ) : (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Agregar API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={addProvider}
                  onChange={e => setAddProvider(e.target.value)}
                >
                  {allProviders.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {configuredProviders.find(c => c.id === p.id) ? '(actualizar)' : ''}
                    </option>
                  ))}
                </select>
                {addProvider && PROVIDER_LINKS[addProvider] && (
                  <a
                    href={PROVIDER_LINKS[addProvider]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Obtener key en {allProviders.find(p => p.id === addProvider)?.name}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <div className="space-y-2">
                <Label>Etiqueta (opcional)</Label>
                <Input
                  placeholder="Ej: Cuenta personal"
                  value={addLabel}
                  onChange={e => setAddLabel(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  placeholder={PROVIDER_PREFIXES[addProvider] || 'Pega tu API key aquí'}
                  value={addKey}
                  onChange={e => setAddKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-8 w-8 p-0"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Endpoint info */}
            {addProvider && (
              <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
                <p className="font-medium">Endpoint del proveedor:</p>
                <p className="font-mono text-muted-foreground">{PROVIDER_ENDPOINTS[addProvider] || 'default'}</p>
                <p className="text-muted-foreground mt-1">
                  El modelo se selecciona desde el chat de cada agente.
                  {addProvider === 'openrouter' && ' OpenRouter carga 200+ modelos dinámicamente.'}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleAdd}
                disabled={!addKey.trim() || !addProvider || saving !== null}
              >
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

      {/* Quick guide */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Guía rápida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">OpenRouter</span> es la opción recomendada — con una sola key accedes a 200+ modelos
            (Llama, Mistral, DeepSeek, Qwen, Claude, GPT y más). Regístrate en openrouter.ai y crea una key.
          </p>
          <p>
            <span className="font-medium text-foreground">OpenAI</span> para GPT-4o directamente.
            <span className="font-medium text-foreground"> Google Gemini</span> tiene generoso free tier.
            <span className="font-medium text-foreground"> HuggingFace</span> para modelos open source.
          </p>
          <p>
            El modelo se selecciona desde el icono de configuración en el chat de cada agente.
            Puedes cambiar de proveedor y modelo en cualquier momento.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}