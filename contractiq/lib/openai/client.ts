import OpenAI from 'openai'

let openaiInstance: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiInstance
}

const DEFAULT_MODEL = 'gpt-4o'
const DEFAULT_MAX_TOKENS_EXTRACTION = 2000
const DEFAULT_MAX_TOKENS_CHAT = 1000
const DEFAULT_TEMPERATURE_EXTRACTION = 0.1
const DEFAULT_TEMPERATURE_CHAT = 0.4

interface ExtractionOptions {
  maxRetries?: number
  retryDelays?: number[]
}

export async function callExtractionAPI(
  prompt: string,
  options: ExtractionOptions = {}
): Promise<string> {
  const { maxRetries = 3, retryDelays = [1000, 2000, 4000] } = options

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL
  const maxTokens = parseInt(
    process.env.OPENAI_MAX_TOKENS_EXTRACTION || String(DEFAULT_MAX_TOKENS_EXTRACTION)
  )
  const temperature = parseFloat(
    process.env.OPENAI_TEMPERATURE_EXTRACTION || String(DEFAULT_TEMPERATURE_EXTRACTION)
  )

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await getOpenAI().chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
        temperature,
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from OpenAI')
      }

      return content
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1
      if (isLastAttempt) {
        throw error
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelays[attempt] || 1000)
      )
    }
  }

  throw new Error('Max retries exceeded')
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function callChatAPI(messages: ChatMessage[]): Promise<string> {
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL
  const maxTokens = parseInt(
    process.env.OPENAI_MAX_TOKENS_CHAT || String(DEFAULT_MAX_TOKENS_CHAT)
  )
  const temperature = parseFloat(
    process.env.OPENAI_TEMPERATURE_CHAT || String(DEFAULT_TEMPERATURE_CHAT)
  )

  const response = await getOpenAI().chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('Empty response from OpenAI')
  }

  return content
}
