import type { LLMProvider, LLMModel } from './types'

// ============================================================
// Provider configurations
// ============================================================

export interface ProviderConfig {
  id: LLMProvider
  name: string
  envKey: string
  baseURL?: string
}

export const PROVIDERS: Record<LLMProvider, ProviderConfig> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    envKey: 'ANTHROPIC_API_KEY',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    envKey: 'GOOGLE_AI_API_KEY',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    baseURL: 'https://openrouter.ai/api/v1',
  },
}

// ============================================================
// Available models per provider
// ============================================================

export const MODELS: LLMModel[] = [
  // Anthropic
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', contextWindow: 200000 },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', contextWindow: 200000 },

  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128000 },

  // Google Gemini (OpenAI-compatible endpoint)
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', contextWindow: 1000000 },
  { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash', provider: 'gemini', contextWindow: 1000000 },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', contextWindow: 2000000 },

  // OpenRouter (popular models)
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'openrouter', contextWindow: 131072 },
  { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'openrouter', contextWindow: 131072 },
  { id: 'mistralai/mistral-large-latest', name: 'Mistral Large', provider: 'openrouter', contextWindow: 128000 },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'openrouter', contextWindow: 128000 },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'openrouter', contextWindow: 131072 },
]

// ============================================================
// Helpers
// ============================================================

/** Returns only providers that have an API key configured */
export function getAvailableProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS).filter(p => !!process.env[p.envKey])
}

/** Returns models for a given provider */
export function getModelsForProvider(provider: LLMProvider): LLMModel[] {
  return MODELS.filter(m => m.provider === provider)
}

/** Returns the default model for a provider */
export function getDefaultModel(provider: LLMProvider): string {
  const models = getModelsForProvider(provider)
  return models[0]?.id || ''
}

/** Check if a specific provider is configured */
export function isProviderAvailable(provider: LLMProvider): boolean {
  return !!process.env[PROVIDERS[provider].envKey]
}
