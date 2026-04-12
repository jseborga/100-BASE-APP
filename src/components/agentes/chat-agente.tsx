'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Loader2, Trash2, Bot, User, Plus, ArrowRight, History, MessageSquarePlus, Settings2, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentContext, AgentMessage } from '@/lib/anthropic/agents'

// ============================================================
// Types
// ============================================================

interface ChatConversation {
  id: string
  title: string
  messages: AgentMessage[]
  createdAt: number
  updatedAt: number
}

interface ChatAgenteProps {
  agente: string
  endpoint: string
  contexto: AgentContext
  placeholder?: string
  initialPrompt?: string
}

// ============================================================
// Helpers
// ============================================================

const STORAGE_PREFIX = 'cos-chat-'
const MAX_CONTEXT_KEY = 'cos-chat-max-context'
const DEFAULT_MAX_CONTEXT = 20

function storageKey(agente: string, proyectoId?: string) {
  return `${STORAGE_PREFIX}${agente}-${proyectoId || 'global'}`
}

function loadConversations(agente: string, proyectoId?: string): ChatConversation[] {
  try {
    const raw = localStorage.getItem(storageKey(agente, proyectoId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveConversations(agente: string, proyectoId: string | undefined, convos: ChatConversation[]) {
  // Keep last 20 conversations max
  const trimmed = convos.slice(0, 20)
  localStorage.setItem(storageKey(agente, proyectoId), JSON.stringify(trimmed))
}

function getMaxContext(): number {
  try {
    const val = localStorage.getItem(MAX_CONTEXT_KEY)
    return val ? parseInt(val, 10) : DEFAULT_MAX_CONTEXT
  } catch { return DEFAULT_MAX_CONTEXT }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function deriveTitle(messages: AgentMessage[]): string {
  const first = messages.find(m => m.role === 'user')
  if (!first) return 'Nueva conversacion'
  const text = first.content.slice(0, 60)
  return text.length < first.content.length ? text + '...' : text
}

// ============================================================
// SSE stream reader (shared)
// ============================================================

async function readStream(
  response: Response,
  onChunk: (text: string) => void,
) {
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  if (!reader) return

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) throw new Error(parsed.error)
          if (parsed.text) onChunk(parsed.text)
        } catch (e) {
          if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e
        }
      }
    }
  }
}

// ============================================================
// Component
// ============================================================

export function ChatAgente({
  agente,
  endpoint,
  contexto,
  placeholder = 'Escribe tu consulta...',
  initialPrompt,
}: ChatAgenteProps) {
  // ------- State -------
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [maxContext, setMaxContext] = useState(DEFAULT_MAX_CONTEXT)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const initialSent = useRef(false)

  // ------- Load from localStorage on mount -------
  useEffect(() => {
    const convos = loadConversations(agente, contexto.proyecto_id)
    setConversations(convos)
    setMaxContext(getMaxContext())
    // Resume most recent conversation if it exists and no initialPrompt
    if (convos.length > 0 && !initialPrompt) {
      setActiveId(convos[0].id)
      setMessages(convos[0].messages)
    }
  }, [agente, contexto.proyecto_id, initialPrompt])

  // ------- Persist messages on change -------
  const persistMessages = useCallback((msgs: AgentMessage[], convoId: string | null) => {
    if (msgs.length === 0) return
    const proyId = contexto.proyecto_id

    setConversations(prev => {
      let updated: ChatConversation[]
      const existing = prev.find(c => c.id === convoId)
      if (existing) {
        updated = prev.map(c =>
          c.id === convoId
            ? { ...c, messages: msgs, title: deriveTitle(msgs), updatedAt: Date.now() }
            : c
        )
      } else {
        const newConvo: ChatConversation = {
          id: convoId || generateId(),
          title: deriveTitle(msgs),
          messages: msgs,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        updated = [newConvo, ...prev]
        if (!convoId) setActiveId(newConvo.id)
      }
      // Sort by most recent
      updated.sort((a, b) => b.updatedAt - a.updatedAt)
      saveConversations(agente, proyId, updated)
      return updated
    })
  }, [agente, contexto.proyecto_id])

  // ------- Scrolling -------
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // ------- Auto-resize textarea -------
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // ------- Focus on mount -------
  useEffect(() => {
    textareaRef.current?.focus()
  }, [agente])

  // ------- Auto-send initial prompt -------
  useEffect(() => {
    if (initialPrompt && !initialSent.current && messages.length === 0) {
      initialSent.current = true
      sendMessageDirect(initialPrompt)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt])

  // ------- Send message (core) -------
  const sendMessageDirect = async (text: string) => {
    const userMessage: AgentMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    let assistantContent = ''
    const currentId = activeId || generateId()
    if (!activeId) setActiveId(currentId)

    try {
      // Only send last N messages as historial
      const historial = messages.slice(-maxContext)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: text,
          contexto,
          historial,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error del agente')
      }

      await readStream(response, (chunk) => {
        assistantContent += chunk
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
          return updated
        })
      })
    } catch (error) {
      console.error('Agent error:', error)
      assistantContent = `**Error:** ${error instanceof Error ? error.message : 'No se pudo conectar con el agente'}`
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
        return updated
      })
    } finally {
      setIsLoading(false)
      // Persist after response complete
      setMessages(prev => {
        persistMessages(prev, currentId)
        return prev
      })
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return
    await sendMessageDirect(input.trim())
  }

  // ------- Conversation management -------
  const startNewChat = () => {
    setActiveId(null)
    setMessages([])
    setInput('')
    setShowHistory(false)
    initialSent.current = false
    textareaRef.current?.focus()
  }

  const loadConversation = (convo: ChatConversation) => {
    setActiveId(convo.id)
    setMessages(convo.messages)
    setShowHistory(false)
  }

  const deleteConversation = (convoId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const proyId = contexto.proyecto_id
    setConversations(prev => {
      const updated = prev.filter(c => c.id !== convoId)
      saveConversations(agente, proyId, updated)
      return updated
    })
    if (activeId === convoId) {
      setActiveId(null)
      setMessages([])
    }
  }

  const clearAllHistory = () => {
    const proyId = contexto.proyecto_id
    localStorage.removeItem(storageKey(agente, proyId))
    setConversations([])
    setActiveId(null)
    setMessages([])
    setShowHistory(false)
  }

  const updateMaxContext = (val: number) => {
    setMaxContext(val)
    localStorage.setItem(MAX_CONTEXT_KEY, String(val))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: history toggle + new chat */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/30">
        <Button
          variant={showHistory ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => { setShowHistory(!showHistory); setShowSettings(false) }}
        >
          <History className="w-3.5 h-3.5" />
          Historial
          {conversations.length > 0 && (
            <span className="ml-0.5 text-[10px] bg-muted-foreground/20 rounded-full px-1.5">{conversations.length}</span>
          )}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={startNewChat}>
          <MessageSquarePlus className="w-3.5 h-3.5" />
          Nuevo chat
        </Button>
        <div className="flex-1" />
        <Button
          variant={showSettings ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => { setShowSettings(!showSettings); setShowHistory(false) }}
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Contexto: {maxContext} msgs</span>
        </Button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b bg-card px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Mensajes de contexto</p>
            <button onClick={() => setShowSettings(false)} className="p-0.5 rounded hover:bg-muted">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Cantidad de mensajes anteriores enviados al agente como contexto. Mas mensajes = mejor memoria pero mas lento y costoso.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={50}
              value={maxContext}
              onChange={e => updateMaxContext(parseInt(e.target.value, 10))}
              className="flex-1 h-1.5 accent-primary"
            />
            <span className="text-sm font-mono w-8 text-right">{maxContext}</span>
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
            <span>2 (rapido)</span>
            <span>50 (mas contexto)</span>
          </div>
        </div>
      )}

      {/* History panel */}
      {showHistory && (
        <div className="border-b bg-card max-h-64 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">Sin conversaciones guardadas</p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {conversations.map(convo => (
                <button
                  key={convo.id}
                  onClick={() => loadConversation(convo)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors hover:bg-muted group ${
                    activeId === convo.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{convo.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {convo.messages.length} msgs &middot; {new Date(convo.updatedAt).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(convo.id, e)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))}
              <div className="pt-2 px-1 border-t mt-2">
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-destructive hover:text-destructive" onClick={clearAllHistory}>
                  <Trash2 className="w-3 h-3 mr-1.5" />
                  Borrar todo el historial
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md px-6">
              <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
              <p className="text-lg font-medium text-muted-foreground/60">
                Agente de {agente}
              </p>
              <p className="text-sm text-muted-foreground/40 mt-2">
                {contexto.proyecto_nombre
                  ? `Proyecto: ${contexto.proyecto_nombre} — ${contexto.pais}`
                  : `Pais: ${contexto.pais}`}
              </p>
              {conversations.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5 text-xs"
                  onClick={() => setShowHistory(true)}
                >
                  <History className="w-3.5 h-3.5" />
                  Ver {conversations.length} conversacion{conversations.length > 1 ? 'es' : ''} anterior{conversations.length > 1 ? 'es' : ''}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className={`${msg.role === 'user' ? 'max-w-[75%]' : 'flex-1 min-w-0'}`}>
                  {msg.role === 'assistant' ? (
                    msg.content ? (
                      <>
                      <div className="prose prose-sm dark:prose-invert max-w-none
                        prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold
                        prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
                        prose-p:my-2 prose-p:leading-relaxed
                        prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                        prose-strong:font-semibold
                        prose-code:text-xs prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                        prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg prose-pre:text-xs prose-pre:my-3
                        prose-table:text-xs prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5
                        prose-table:border-collapse prose-th:border prose-td:border prose-th:bg-muted
                        prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
                      ">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      {/* Action buttons after completed assistant messages */}
                      {!isLoading && i === messages.length - 1 && contexto.proyecto_id && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed">
                          <span className="text-[10px] text-muted-foreground">Acciones:</span>
                          <a href={`/dashboard/catalogo?proyecto=${contexto.proyecto_id}`}>
                            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                              <Plus className="w-3 h-3" />
                              Agregar partidas al proyecto
                            </Button>
                          </a>
                          <a href={`/dashboard/proyectos/${contexto.proyecto_id}`}>
                            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                              <ArrowRight className="w-3 h-3" />
                              Ver proyecto
                            </Button>
                          </a>
                        </div>
                      )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Pensando...</span>
                      </div>
                    )
                  ) : (
                    <div className="rounded-2xl bg-primary text-primary-foreground px-4 py-3 text-sm whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t bg-background">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
                placeholder={placeholder}
                rows={1}
                className="w-full resize-none rounded-xl border border-input bg-muted/50 px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-1.5 pb-0.5">
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" onClick={startNewChat} title="Nuevo chat"
                  className="h-10 w-10 rounded-xl text-muted-foreground">
                  <MessageSquarePlus className="w-4 h-4" />
                </Button>
              )}
              <Button onClick={sendMessage} disabled={!input.trim() || isLoading}
                size="icon" className="h-10 w-10 rounded-xl">
                {isLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
            Shift+Enter para nueva linea &middot; Las respuestas pueden contener errores
          </p>
        </div>
      </div>
    </div>
  )
}
