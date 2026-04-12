import type { LLMProvider, LLMModel } from './types'

// ============================================================
// Provider configurations
// ============================================================

export interface ProviderConfig {
  id: LLMProvider
  name: string
  description: string
  baseURL?: string
  modelsEndpoint?: string  // for dynamic model fetching
  supportsModelFetch: boolean
}

export const PROVIDERS: Record<LLMProvider, ProviderConfig> = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '200+ modelos: Llama, Mistral, DeepSeek, Qwen, Claude, GPT y m\u00e1s',
    baseURL: 'https://openrouter.ai/api/v1',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    supportsModelFetch: true,
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini, GPT-4 Turbo',
    supportsModelFetch: false,
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 2.0 Flash, Gemini 2.5 Flash, Gemini 1.5 Pro',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    supportsModelFetch: false,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Claude Sonnet 4, Claude 3.5 Haiku',
    supportsModelFetch: false,
  },
  huggingface: {
    id: 'huggingface',
    name: 'HuggingFace',
    description: 'Modelos open source v\u00eda HuggingFace Inference API',
    baseURL: 'https://router.huggingface.co/v1',
    supportsModelFetch: false,
  },
}

// ============================================================
// Static model lists (for providers without dynamic fetch)
// ============================================================

export const STATIC_MODELS: LLMModel[] = [
  // Anthropic
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', contextWindow: 200000 },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', contextWindow: 200000 },

  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128000 },
  { id: 'o1-mini', name: 'o1 Mini', provider: 'openai', contextWindow: 128000 },

  // Google Gemini
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', contextWindow: 1000000 },
  { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash', provider: 'gemini', contextWindow: 1000000 },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', contextWindow: 2000000 },

  // HuggingFace (popular open models)
  { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B', provider: 'huggingface', contextWindow: 131072 },
  { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B', provider: 'huggingface', contextWindow: 32768 },
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', provider: 'huggingface', contextWindow: 131072 },
]

/** Get static models for a provider */
export function getStaticModels(provider: LLMProvider): LLMModel[] {
  return STATIC_MODELS.filter(m => m.provider === provider)
}

/** Get the default model for a provider */
export function getDefaultModel(provider: LLMProvider): string {
  const defaults: Record<LLMProvider, string> = {
    anthropic: 'claude-sonnet-4-20250514',
    openai: 'gpt-4o',
    gemini: 'gemini-2.0-flash',
    openrouter: 'anthropic/claude-sonnet-4',
    huggingface: 'meta-llama/Llama-3.1-70B-Instruct',
  }
  return defaults[provider]
}
