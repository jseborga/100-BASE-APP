'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Send, Loader2, Trash2, Bot, User, Settings2 } from 'lucide-react'
import type { AgentContext, AgentMessage } from '@/lib/anthropic/agents'

interface ProviderInfo {
  id: string
  name: string
  models: { id: string; name: string; contextWindow: number }[]
}

interface ChatAgenteProps {
  agente: string
  titulo: string
  descripcion: string
  endpoint: string
  contexto: AgentContext
  placeholder?: string
}

export function ChatAgente({
  agente,
  titulo,
  descripcion,
  endpoint,
  contexto,
  placeholder = 'Escribe tu consulta...',
}: ChatAgenteProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // LLM provider/model state
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [loadingConfig, setLoadingConfig] = useState(true)

  // Fetch available providers on mount
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/config/llm')
        if (res.ok) {
          const data = await res.json()
          const provs: ProviderInfo[] = data.providers || []
          setProviders(provs)
          if (provs.length > 0) {
            setSelectedProvider(provs[0].id)
            if (provs[0].models.length > 0) {
              setSelectedModel(provs[0].models[0].id)
            }
          }
        }
      } catch (err) {
        console.error('Error fetching LLM config:', err)
      } finally {
        setLoadingConfig(false)
      }
    }
    fetchConfig()
  }, [])

  // Update model when provider changes
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId)
    const prov = providers.find(p => p.id === providerId)
    if (prov && prov.models.length > 0) {
      setSelectedModel(prov.models[0].id)
    } else {
      setSelectedModel('')
    }
  }

  const currentProvider = providers.find(p => p.id === selectedProvider)
  const currentModel = currentProvider?.models.find(m => m.id === selectedModel)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
    }
  }, [input])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: AgentMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    // Add placeholder for assistant response
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: userMessage.content,
          contexto,
          historial: messages,
          provider: selectedProvider || undefined,
          model: selectedModel || undefined,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error del agente')
      }

      // Read SSE stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                if (parsed.error) {
                  throw new Error(parsed.error)
                }
                if (parsed.text) {
                  assistantContent += parsed.text
                  setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = {
                      role: 'assistant',
                      content: assistantContent,
                    }
                    return updated
                  })
                }
              } catch (e) {
                if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
                  throw e
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Agent error:', error)
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'No se pudo conectar con el agente'}`,
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setInput('')
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{titulo}</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{descripcion}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentModel && (
              <Badge variant="secondary" className="text-xs">
                {currentModel.name}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {contexto.pais} ({contexto.pais_codigo})
            </Badge>
            <Button
              variant={showSettings ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              title="Configurar modelo"
            >
              <Settings2 className="w-4 h-4" />
            </Button>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChat} title="Limpiar chat">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Model settings panel */}
        {showSettings && (
          <div className="mt-3 p-3 rounded-lg bg-muted/50 border space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Proveedor</label>
                {loadingConfig ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Cargando...
                  </div>
                ) : providers.length === 0 ? (
                  <p className="text-xs text-destructive">
                    No hay proveedores configurados. Agrega API keys en las variables de entorno.
                  </p>
                ) : (
                  <select
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={selectedProvider}
                    onChange={e => handleProviderChange(e.target.value)}
                  >
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Modelo</label>
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  disabled={!currentProvider}
                >
                  {currentProvider?.models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {currentModel && (
              <p className="text-xs text-muted-foreground">
                Contexto: {(currentModel.contextWindow / 1000).toFixed(0)}K tokens
              </p>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Haz tu primera consulta al agente de {agente}</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="whitespace-pre-wrap">
                      {msg.content || (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Pensando...
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="flex gap-2 items-end border-t pt-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || providers.length === 0}
            size="sm"
            className="h-10 w-10 p-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
