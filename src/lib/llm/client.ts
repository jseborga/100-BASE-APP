import type { LLMConfig, LLMStreamOptions } from './types'
import { PROVIDERS } from './providers'

// ============================================================
// Unified LLM streaming client
//
// Supports: Anthropic (native SDK), OpenAI, Gemini, OpenRouter,
// HuggingFace (all OpenAI-compatible)
// ============================================================

/**
 * Stream text from any supported LLM provider.
 * Returns an AsyncGenerator that yields text chunks.
 * API key is provided at runtime (from encrypted DB storage).
 */
export async function* streamLLM(
  config: LLMConfig,
  options: LLMStreamOptions
): AsyncGenerator<string> {
  if (!config.apiKey) {
    throw new Error(`No API key provided for ${config.provider}`)
  }

  if (config.provider === 'anthropic') {
    yield* streamAnthropic(config.apiKey, config.model, options)
  } else {
    const baseURL = PROVIDERS[config.provider]?.baseURL
    yield* streamOpenAICompatible(config.apiKey, config.model, options, baseURL, config.provider)
  }
}

// ============================================================
// Anthropic streaming (native SDK)
// ============================================================

async function* streamAnthropic(
  apiKey: string,
  model: string,
  options: LLMStreamOptions
): AsyncGenerator<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey })

  const stream = client.messages.stream({
    model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature,
    system: options.system,
    messages: options.messages,
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text
    }
  }
}

// ============================================================
// OpenAI-compatible streaming (OpenAI, Gemini, OpenRouter, HuggingFace)
// ============================================================

async function* streamOpenAICompatible(
  apiKey: string,
  model: string,
  options: LLMStreamOptions,
  baseURL?: string,
  provider?: string
): AsyncGenerator<string> {
  const { default: OpenAI } = await import('openai')

  const clientOptions: Record<string, unknown> = { apiKey }
  if (baseURL) clientOptions.baseURL = baseURL

  // OpenRouter requires extra headers
  if (provider === 'openrouter') {
    clientOptions.defaultHeaders = {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://constructionos.app',
      'X-Title': 'ConstructionOS',
    }
  }

  const client = new OpenAI(clientOptions as ConstructorParameters<typeof OpenAI>[0])

  const stream = await client.chat.completions.create({
    model,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    stream: true,
    messages: [
      { role: 'system', content: options.system },
      ...options.messages,
    ],
  })

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content
    if (delta) {
      yield delta
    }
  }
}
