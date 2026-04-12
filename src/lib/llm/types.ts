// ============================================================
// Unified LLM types for multi-provider support
// ============================================================

export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'openrouter'

export interface LLMModel {
  id: string
  name: string
  provider: LLMProvider
  contextWindow: number
}

export interface LLMConfig {
  provider: LLMProvider
  model: string
}

export interface LLMStreamOptions {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
  temperature?: number
}
