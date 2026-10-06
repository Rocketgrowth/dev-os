import { PDFParse } from 'pdf-parse'

export interface ExtractResult {
  text: string
  pageCount: number
}

export async function extractText(buffer: Buffer): Promise<ExtractResult> {
  const parser = new PDFParse({ data: buffer })

  try {
    const result = await parser.getText()

    const textWithMarkers = result.pages
      .map((page) => `[PAGE ${page.num}]\n${page.text.trim()}`)
      .join('\n\n')

    return {
      text: textWithMarkers,
      pageCount: result.total,
    }
  } finally {
    await parser.destroy()
  }
}

export function countWords(text: string): number {
  return text
    .replace(/\[PAGE \d+\]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0).length
}
