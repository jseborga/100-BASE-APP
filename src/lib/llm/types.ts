// ============================================================
// Unified LLM types for multi-provider support
// ============================================================

export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'openrouter' | 'huggingface'

export interface LLMModel {
  id: string
  name: string
  provider: LLMProvider
  contextWindow: number
  pricing?: { prompt: string; completion: string }
}

export interface LLMConfig {
  provider: LLMProvider
  model: string
  apiKey: string  // decrypted key at runtime
}

export interface LLMStreamOptions {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
  temperature?: number
}
