import { ContractType } from '@/types'
import { STANDARD_TERMS } from '@/constants/terms'

interface ExtractionPromptParams {
  contractText: string
  contractType: ContractType
  customTerms?: string[]
}

export function buildExtractionPrompt(params: ExtractionPromptParams): string {
  const { contractText, contractType, customTerms = [] } = params
  const standardTerms = [...STANDARD_TERMS[contractType]]
  const allTerms = [...standardTerms, ...customTerms]

  const termsList = allTerms.map((term, i) => `${i + 1}. ${term}`).join('\n')

  return `You are a contract analysis expert. Extract the following key terms from this ${contractType.toUpperCase()} contract.

For EACH term in the list, provide:
- term_name: The exact term name from the list below
- value: The extracted value (or null if not found in the document)
- page_number: The page number where the term was found (look for [PAGE N] markers in the text), or null if not found
- confidence_score: Your confidence in the extraction from 0.0 to 1.0
- source_sentence: The exact sentence from the contract containing this term (verbatim, max 200 chars), or null if not found

Terms to extract:
${termsList}

IMPORTANT RULES:
1. Only extract information explicitly stated in the contract. Do not infer or assume.
2. If a term is not found, set value, page_number, and source_sentence to null, and confidence_score to 0.0
3. The confidence_score should reflect how certain you are about the extraction:
   - 0.9-1.0: Term clearly stated with exact match found
   - 0.7-0.9: Term found but may require interpretation
   - 0.5-0.7: Term partially addressed or implied
   - 0.0-0.5: Term not clearly present or very uncertain
4. Always include the source_sentence that contains the term (truncate if over 200 chars)
5. Page numbers are indicated by [PAGE N] markers in the text. Extract the page number from the nearest [PAGE N] marker.
6. Return ALL terms from the list, even if not found (with null values and 0.0 confidence).

Respond with a JSON object in this exact format:
{
  "terms": [
    {
      "term_name": "string",
      "value": "string or null",
      "page_number": number or null,
      "confidence_score": number,
      "source_sentence": "string or null"
    }
  ]
}

Contract text:
${contractText}`
}
