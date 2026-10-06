import { extractText as unpdfExtractText, getDocumentProxy } from 'unpdf'

export interface ExtractResult {
  text: string
  pageCount: number
}

export async function extractText(buffer: Buffer): Promise<ExtractResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { totalPages, text } = await unpdfExtractText(pdf, { mergePages: false })

  const pages = Array.isArray(text) ? text : [text]
  const textWithMarkers = pages
    .map((pageText, index) => `[PAGE ${index + 1}]\n${pageText.trim()}`)
    .join('\n\n')

  return {
    text: textWithMarkers,
    pageCount: totalPages,
  }
}

export function countWords(text: string): number {
  return text
    .replace(/\[PAGE \d+\]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}
