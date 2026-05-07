import { streamText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { ExternalModelConfig } from '../group/types'

export interface ExternalModelCompletionInput {
  model: ExternalModelConfig
  prompt: string
  abortSignal?: AbortSignal
}

export interface ExternalModelCompletionResult {
  content: string
}

export interface ExternalModelClient {
  stream?(input: ExternalModelCompletionInput): AsyncIterable<string>
  complete(input: ExternalModelCompletionInput): Promise<ExternalModelCompletionResult>
}

export function createExternalModelClient(fetchImpl: typeof fetch = fetch): ExternalModelClient {
  return {
    stream(input) {
      return streamExternalModel(input, fetchImpl)
    },
    async complete(input) {
      let content = ''
      for await (const chunk of streamExternalModel(input, fetchImpl)) content += chunk
      if (!content.trim()) throw new Error('外部模型返回格式无效')
      return { content }
    },
  }
}

async function* streamExternalModel(input: ExternalModelCompletionInput, fetchImpl: typeof fetch): AsyncIterable<string> {
  const provider = input.model.format === 'anthropic'
    ? createAnthropic({
      apiKey: input.model.apiKey,
      baseURL: input.model.baseUrl,
      fetch: fetchImpl,
    })
    : createOpenAICompatible({
      name: `openteam-${input.model.id}`,
      apiKey: input.model.apiKey,
      baseURL: input.model.baseUrl,
      fetch: fetchImpl,
    })
  const result = streamText({
    model: provider(input.model.modelName as never),
    prompt: input.prompt,
    abortSignal: input.abortSignal,
  })
  for await (const textPart of result.textStream) {
    if (textPart) yield textPart
  }
}
