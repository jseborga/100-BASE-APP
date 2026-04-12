import type { LLMConfig, LLMStreamOptions } from './types'
import { PROVIDERS } from './providers'

// ============================================================
// Unified LLM streaming client
//
// Supports: Anthropic (native SDK), OpenAI, Gemini, OpenRouter
// (the last three all use OpenAI-compatible API via openai SDK)
// ============================================================

/**
 * Stream text from any supported LLM provider.
 * Returns an AsyncGenerator that yields text chunks.
 */
export async function* streamLLM(
  config: LLMConfig,
  options: LLMStreamOptions
): AsyncGenerator<string> {
  const providerConfig = PROVIDERS[config.provider]
  const apiKey = process.env[providerConfig.envKey]

  if (!apiKey) {
    throw new Error(
      `API key not configured for ${providerConfig.name}. Set ${providerConfig.envKey} in environment variables.`
    )
  }

  if (config.provider === 'anthropic') {
    yield* streamAnthropic(apiKey, config.model, options)
  } else {
    yield* streamOpenAICompatible(apiKey, config.model, options, providerConfig.baseURL)
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
  // Dynamic import to avoid loading SDK when not needed
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
// OpenAI-compatible streaming (OpenAI, Gemini, OpenRouter)
// ============================================================

async function* streamOpenAICompatible(
  apiKey: string,
  model: string,
  options: LLMStreamOptions,
  baseURL?: string
): AsyncGenerator<string> {
  // Dynamic import to avoid loading SDK when not needed
  const { default: OpenAI } = await import('openai')

  const clientOptions: { apiKey: string; baseURL?: string } = { apiKey }
  if (baseURL) clientOptions.baseURL = baseURL

  const client = new OpenAI(clientOptions)

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
