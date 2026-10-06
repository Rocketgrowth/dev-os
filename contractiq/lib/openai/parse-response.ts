import { extractionResponseSchema, ExtractedTerm } from '@/lib/validation/schemas'

export function parseExtractionResponse(response: string): ExtractedTerm[] {
  try {
    const parsed = JSON.parse(response)
    const validated = extractionResponseSchema.parse(parsed)
    return validated.terms
  } catch (error) {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        const validated = extractionResponseSchema.parse(parsed)
        return validated.terms
      } catch {
        throw new Error('Invalid extraction response format')
      }
    }
    throw new Error('Invalid extraction response format')
  }
}

interface ParsedChatResponse {
  content: string
  pageCitation: number | null
}

export function parseChatResponse(response: string): ParsedChatResponse {
  const pageMatch = response.match(/\[Page\s*(\d+)\]/i)
  const pageCitation = pageMatch ? parseInt(pageMatch[1], 10) : null

  return {
    content: response,
    pageCitation,
  }
}
