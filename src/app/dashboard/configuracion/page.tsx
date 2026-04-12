'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Key, Plus, Trash2, Check, Loader2, Eye, EyeOff, Shield, ExternalLink } from 'lucide-react'

interface ProviderInfo {
  id: string
  name: string
  description: string
  keyId?: string
  maskedKey?: string
  label?: string
  models?: { id: string; name: string }[]
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
    if (!confirm('\u00bfEliminar esta API key?')) return
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

  // Providers not yet configured
  const unconfigured = allProviders.filter(
    p => !configuredProviders.find(c => c.id === p.id)
  )

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
        <h1 className="text-3xl font-bold">Configuraci\u00f3n</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tus API keys de proveedores de IA para los agentes
        </p>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
        <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Tus keys est\u00e1n encriptadas</p>
          <p className="text-muted-foreground mt-1">
            Las API keys se almacenan con cifrado AES-256-GCM. Cada usuario gestiona sus propias keys
            y solo se usan para sus consultas a los agentes.
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
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="outline" className="text-xs">{p.maskedKey}</Badge>
                      {p.label && (
                        <Badge variant="secondary" className="text-xs">{p.label}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                    {p.models && p.models.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {p.models.length} modelo{p.models.length !== 1 ? 's' : ''}: {p.models.slice(0, 3).map(m => m.name).join(', ')}
                        {p.models.length > 3 ? ` +${p.models.length - 3} m\u00e1s` : ''}
                      </p>
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
        <Button onClick={() => { setShowAddForm(true); setAddProvider(unconfigured[0]?.id || 'openrouter') }} className="gap-2">
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
                  placeholder={PROVIDER_PREFIXES[addProvider] || 'Pega tu API key aqu\u00ed'}
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
          <CardTitle className="text-base">Gu\u00eda r\u00e1pida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">OpenRouter</span> es la opci\u00f3n recomendada \u2014 con una sola key accedes a 200+ modelos
            (Llama, Mistral, DeepSeek, Qwen, Claude, GPT y m\u00e1s). Reg\u00edstrate en openrouter.ai y crea una key.
          </p>
          <p>
            <span className="font-medium text-foreground">OpenAI</span> para GPT-4o y GPT-4o-mini directamente.
            <span className="font-medium text-foreground"> Google Gemini</span> tiene generoso free tier.
            <span className="font-medium text-foreground"> HuggingFace</span> para modelos open source.
          </p>
          <p>
            Cada usuario gestiona sus propias keys. Las keys se encriptan y nunca se comparten entre usuarios.
            Puedes cambiar de modelo en cualquier momento desde el chat del agente.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
