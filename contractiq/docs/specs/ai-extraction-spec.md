# AI Key Term Extraction Specification

## Overview

After a contract is uploaded, the system uses GPT-4o to extract key terms. Each term includes the extracted value, page number, confidence score, and source sentence.

---

## Standard Terms

### NDA Terms (10)

| # | Term Name | Description |
|---|-----------|-------------|
| 1 | Parties | Names of the contracting parties |
| 2 | Effective Date | When the agreement takes effect |
| 3 | Confidentiality Obligations | What must be kept confidential |
| 4 | Permitted Disclosures | Allowed exceptions to confidentiality |
| 5 | Term & Duration | How long the agreement lasts |
| 6 | Governing Law | Which jurisdiction's laws apply |
| 7 | Jurisdiction | Where disputes will be resolved |
| 8 | IP Ownership | Who owns intellectual property |
| 9 | Non-Solicitation | Restrictions on hiring/soliciting |
| 10 | Breach & Remedy | What happens if agreement is breached |

### MSA Terms (12)

| # | Term Name | Description |
|---|-----------|-------------|
| 1 | Parties | Names of the contracting parties |
| 2 | Service Scope | Description of services provided |
| 3 | Payment Terms | How and when payments are made |
| 4 | Invoice Schedule | Timing of invoices |
| 5 | Late Payment Penalty | Fees for late payments |
| 6 | Liability Cap | Maximum liability amount |
| 7 | Indemnification | Who indemnifies whom and for what |
| 8 | IP Ownership | Who owns intellectual property |
| 9 | Termination Clause | How the agreement can be ended |
| 10 | Governing Law | Which jurisdiction's laws apply |
| 11 | Dispute Resolution | How disputes are handled |
| 12 | Notice Period | Required notice for termination |

---

## OpenAI Configuration

| Setting | Value |
|---------|-------|
| Model | `gpt-4o` |
| Temperature | `0.1` (deterministic) |
| Response Format | `{ type: "json_object" }` |
| Max Output Tokens | `2,000` |
| Timeout | `20 seconds` |
| Retries | `3` with exponential backoff |

---

## Prompt Template

```typescript
const EXTRACTION_SYSTEM_PROMPT = `You are a contract analysis expert. Extract key terms from the contract text provided.

For each term, provide:
- term_name: The name of the term being extracted
- value: The extracted value from the contract (or null if not found)
- page_number: The page number where this term appears (from [PAGE N] markers)
- confidence_score: Your confidence in the extraction (0.0 to 1.0)
- source_sentence: The exact sentence from the contract that contains this information

Rules:
1. Only extract information that is explicitly stated in the contract
2. If a term is not found, set value to null and confidence_score to 0
3. Be precise with page numbers - use the [PAGE N] markers in the text
4. Source sentence must be a verbatim quote from the contract
5. Confidence score should reflect how certain you are:
   - 1.0: Explicitly stated, no ambiguity
   - 0.7-0.9: Clearly stated but requires interpretation
   - 0.4-0.6: Implied or partially stated
   - 0.1-0.3: Inferred from context
   - 0: Not found in document

Respond with a JSON object in this exact format:
{
  "terms": [
    {
      "term_name": "string",
      "value": "string | null",
      "page_number": "number | null",
      "confidence_score": "number (0.0-1.0)",
      "source_sentence": "string | null"
    }
  ]
}`

const buildExtractionPrompt = (
  contractType: 'nda' | 'msa',
  contractText: string,
  customTerms: string[]
) => {
  const standardTerms = contractType === 'nda' ? NDA_TERMS : MSA_TERMS
  const allTerms = [...standardTerms, ...customTerms]

  return `Extract the following key terms from this ${contractType.toUpperCase()} contract:

Terms to extract:
${allTerms.map((term, i) => `${i + 1}. ${term}`).join('\n')}

Contract Text:
${contractText}`
}
```

---

## Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/api/contracts/[id]/process/route.ts` | Processing API endpoint |
| `src/lib/openai/client.ts` | OpenAI client initialization |
| `src/lib/openai/prompts/extraction.ts` | Extraction prompt builder |
| `src/lib/openai/parse-response.ts` | JSON response parser |
| `src/lib/contracts/process.ts` | Processing orchestration |
| `src/constants/terms.ts` | Standard NDA/MSA term lists |

---

### `src/lib/openai/client.ts`

```typescript
import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
```

---

### `src/constants/terms.ts`

```typescript
export const NDA_TERMS = [
  'Parties',
  'Effective Date',
  'Confidentiality Obligations',
  'Permitted Disclosures',
  'Term & Duration',
  'Governing Law',
  'Jurisdiction',
  'IP Ownership',
  'Non-Solicitation',
  'Breach & Remedy',
] as const

export const MSA_TERMS = [
  'Parties',
  'Service Scope',
  'Payment Terms',
  'Invoice Schedule',
  'Late Payment Penalty',
  'Liability Cap',
  'Indemnification',
  'IP Ownership',
  'Termination Clause',
  'Governing Law',
  'Dispute Resolution',
  'Notice Period',
] as const

export type NdaTerm = typeof NDA_TERMS[number]
export type MsaTerm = typeof MSA_TERMS[number]
```

---

### `src/lib/openai/prompts/extraction.ts`

```typescript
import { NDA_TERMS, MSA_TERMS } from '@/constants/terms'

const SYSTEM_PROMPT = `You are a contract analysis expert. Extract key terms from the contract text provided.

For each term, provide:
- term_name: The name of the term being extracted
- value: The extracted value from the contract (or null if not found)
- page_number: The page number where this term appears (from [PAGE N] markers)
- confidence_score: Your confidence in the extraction (0.0 to 1.0)
- source_sentence: The exact sentence from the contract that contains this information

Rules:
1. Only extract information that is explicitly stated in the contract
2. If a term is not found, set value to null and confidence_score to 0
3. Be precise with page numbers - use the [PAGE N] markers in the text
4. Source sentence must be a verbatim quote from the contract
5. Confidence score should reflect how certain you are:
   - 1.0: Explicitly stated, no ambiguity
   - 0.7-0.9: Clearly stated but requires interpretation
   - 0.4-0.6: Implied or partially stated
   - 0.1-0.3: Inferred from context
   - 0: Not found in document

Respond with a JSON object in this exact format:
{
  "terms": [
    {
      "term_name": "string",
      "value": "string | null",
      "page_number": "number | null",
      "confidence_score": "number",
      "source_sentence": "string | null"
    }
  ]
}`

export function buildExtractionPrompt(
  contractType: 'nda' | 'msa',
  contractText: string,
  customTerms: string[] = []
): { system: string; user: string } {
  const standardTerms = contractType === 'nda' ? NDA_TERMS : MSA_TERMS
  const allTerms = [...standardTerms, ...customTerms]

  const user = `Extract the following key terms from this ${contractType.toUpperCase()} contract:

Terms to extract:
${allTerms.map((term, i) => `${i + 1}. ${term}`).join('\n')}

Contract Text:
${contractText}`

  return { system: SYSTEM_PROMPT, user }
}
```

---

### `src/lib/openai/parse-response.ts`

```typescript
import { z } from 'zod'

const extractedTermSchema = z.object({
  term_name: z.string(),
  value: z.string().nullable(),
  page_number: z.number().nullable(),
  confidence_score: z.number().min(0).max(1),
  source_sentence: z.string().nullable(),
})

const extractionResponseSchema = z.object({
  terms: z.array(extractedTermSchema),
})

export type ExtractedTerm = z.infer<typeof extractedTermSchema>
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>

export function parseExtractionResponse(content: string): ExtractionResponse {
  const parsed = JSON.parse(content)
  return extractionResponseSchema.parse(parsed)
}
```

---

### `src/lib/contracts/process.ts`

```typescript
import { openai } from '@/lib/openai/client'
import { buildExtractionPrompt } from '@/lib/openai/prompts/extraction'
import { parseExtractionResponse, ExtractedTerm } from '@/lib/openai/parse-response'

const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 2000, 4000] // Exponential backoff

export async function extractKeyTerms(
  contractType: 'nda' | 'msa',
  contractText: string,
  customTerms: string[]
): Promise<ExtractedTerm[]> {
  const { system, user } = buildExtractionPrompt(contractType, contractText, customTerms)

  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        temperature: parseFloat(process.env.OPENAI_EXTRACTION_TEMPERATURE || '0.1'),
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from OpenAI')
      }

      const parsed = parseExtractionResponse(content)
      return parsed.terms

    } catch (error) {
      lastError = error as Error
      console.error(`Extraction attempt ${attempt + 1} failed:`, error)

      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]))
      }
    }
  }

  throw lastError || new Error('Extraction failed after retries')
}
```

---

### `src/app/api/contracts/[id]/process/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractKeyTerms } from '@/lib/contracts/process'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const contractId = params.id

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch contract
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (fetchError || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Verify ownership
    if (contract.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if already processed
    if (contract.status === 'completed') {
      return NextResponse.json({ error: 'Contract already processed' }, { status: 400 })
    }

    // Update status to processing
    await supabase
      .from('contracts')
      .update({ status: 'processing' })
      .eq('id', contractId)

    // Fetch custom terms
    const { data: customTerms } = await supabase
      .from('custom_key_terms')
      .select('term_name')
      .eq('contract_id', contractId)

    const customTermNames = customTerms?.map(t => t.term_name) || []

    try {
      // Extract key terms using AI
      const extractedTerms = await extractKeyTerms(
        contract.type,
        contract.contract_text,
        customTermNames
      )

      // Insert key terms
      const keyTermRecords = extractedTerms.map(term => ({
        contract_id: contractId,
        term_name: term.term_name,
        value: term.value,
        page_number: term.page_number,
        confidence_score: term.confidence_score,
        source_sentence: term.source_sentence,
        is_manual: customTermNames.includes(term.term_name),
      }))

      const { data: insertedTerms, error: insertError } = await supabase
        .from('key_terms')
        .insert(keyTermRecords)
        .select()

      if (insertError) {
        throw insertError
      }

      // Update status to completed
      await supabase
        .from('contracts')
        .update({ status: 'completed' })
        .eq('id', contractId)

      return NextResponse.json({
        contract: {
          id: contractId,
          status: 'completed',
        },
        terms: insertedTerms,
      })

    } catch (processingError) {
      // Update status to error
      await supabase
        .from('contracts')
        .update({ status: 'error' })
        .eq('id', contractId)

      throw processingError
    }

  } catch (error) {
    console.error('Processing error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
```

---

## Response Schema

```typescript
interface ExtractionResponse {
  contract: {
    id: string
    status: 'completed'
  }
  terms: Array<{
    id: string
    term_name: string
    value: string | null
    page_number: number | null
    confidence_score: number
    source_sentence: string | null
    is_manual: boolean
  }>
}
```

---

## Error Handling

| Error | HTTP Status | User Message |
|-------|-------------|--------------|
| Contract not found | 404 | "Contract not found" |
| Not owner | 403 | "You don't have access to this contract" |
| Already processed | 400 | "Contract has already been processed" |
| OpenAI API error | 500 | "Processing failed. Please try again" |
| JSON parse error | 500 | "Processing failed. Please try again" |
| Timeout (20s) | 500 | "Processing timed out. Please try again" |

---

## Acceptance Criteria

- [ ] Extraction completes within 30 seconds P95
- [ ] All standard terms for contract type are extracted
- [ ] Custom terms are included in extraction
- [ ] Each term has confidence score 0.0-1.0
- [ ] Each term has page number reference
- [ ] Each term has source sentence quote
- [ ] Terms with no match have null value and 0 confidence
- [ ] Results stored in key_terms table
- [ ] Contract status updated to 'completed' on success
- [ ] Contract status updated to 'error' on failure
- [ ] Retry logic handles transient failures
- [ ] Custom terms marked with is_manual = true
