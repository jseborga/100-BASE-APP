'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Loader2, Trash2, Bot, User, Plus, ArrowRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentContext, AgentMessage } from '@/lib/anthropic/agents'

interface ChatAgenteProps {
  agente: string
  endpoint: string
  contexto: AgentContext
  placeholder?: string
  initialPrompt?: string
}

export function ChatAgente({
  agente,
  endpoint,
  contexto,
  placeholder = 'Escribe tu consulta...',
  initialPrompt,
}: ChatAgenteProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [agente])

  // Auto-send initial prompt if provided
  const initialSent = useRef(false)
  useEffect(() => {
    if (initialPrompt && !initialSent.current && messages.length === 0) {
      initialSent.current = true
      setInput(initialPrompt)
      // Trigger send after a tick so state is set
      setTimeout(() => {
        setInput('')
        // Manually invoke the send logic
        const msg: AgentMessage = { role: 'user', content: initialPrompt }
        setMessages([msg, { role: 'assistant', content: '' }])
        setIsLoading(true)
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensaje: initialPrompt, contexto, historial: [] }),
        }).then(async (response) => {
          if (!response.ok) {
            const err = await response.json()
            throw new Error(err.error || 'Error del agente')
          }
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let content = ''
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
                    if (parsed.error) throw new Error(parsed.error)
                    if (parsed.text) {
                      content += parsed.text
                      setMessages(prev => {
                        const updated = [...prev]
                        updated[updated.length - 1] = { role: 'assistant', content }
                        return updated
                      })
                    }
                  } catch (e) {
                    if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e
                  }
                }
              }
            }
          }
        }).catch((error) => {
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: `**Error:** ${error instanceof Error ? error.message : 'No se pudo conectar'}`,
            }
            return updated
          })
        }).finally(() => setIsLoading(false))
      }, 100)
    }
  }, [initialPrompt, endpoint, contexto, messages.length])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: AgentMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: userMessage.content,
          contexto,
          historial: messages,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error del agente')
      }

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
                if (parsed.error) throw new Error(parsed.error)
                if (parsed.text) {
                  assistantContent += parsed.text
                  setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
                    return updated
                  })
                }
              } catch (e) {
                if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e
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
          content: `**Error:** ${error instanceof Error ? error.message : 'No se pudo conectar con el agente'}`,
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => { setMessages([]); setInput('') }

  return (
    <div className="flex flex-col h-full">
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
                <Button variant="ghost" size="icon" onClick={clearChat} title="Limpiar chat"
                  className="h-10 w-10 rounded-xl text-muted-foreground">
                  <Trash2 className="w-4 h-4" />
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
