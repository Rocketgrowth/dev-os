# AI Key Term Extraction Specification

## Overview

After PDF upload, the system uses OpenAI GPT-4o to extract key terms from the contract. Each term includes a value, page number, confidence score, and source sentence. Standard terms are defined per contract type (NDA: 10 terms, MSA: 12 terms), plus any custom terms added by the user.

---

## User Flow

```
1. Frontend shows progress indicator (Step 2: Analysing with AI)
2. Frontend calls POST /api/contracts/[id]/process
3. Backend:
   - Fetches contract_text from database
   - Fetches custom_key_terms for this contract
   - Builds extraction prompt with standard + custom terms
   - Calls OpenAI GPT-4o with JSON mode
   - Parses and validates JSON response
   - Stores key terms in database
   - Updates contract status to 'completed'
4. On success: redirect to /contracts/[id] (results page)
5. On error: update status to 'error', display error message
```

---

## API Route

### POST /api/contracts/[id]/process

**File:** `app/api/contracts/[id]/process/route.ts`

**Request Body:** None (uses stored contract_text)

**Success Response (200):**
```json
{
  "contract": {
    "id": "uuid",
    "status": "completed"
  },
  "terms": [
    {
      "id": "uuid",
      "term_name": "Governing Law",
      "value": "State of Delaware",
      "page_number": 4,
      "confidence_score": 0.92,
      "source_sentence": "This Agreement shall be governed by the laws of the State of Delaware.",
      "is_manual": false
    }
  ]
}
```

**Error Responses:**

| Status | Error | Condition |
|--------|-------|-----------|
| 400 | "Contract has already been processed." | Status is 'completed' or 'processing' |
| 401 | "Unauthorized" | No valid session |
| 403 | "Forbidden" | Contract belongs to another user |
| 404 | "Contract not found." | Invalid contract ID |
| 500 | "AI extraction failed. Please try again." | OpenAI API error after retries |

**Implementation:**
```typescript
import { createClient } from '@/lib/supabase/server'
import { extractKeyTerms } from '@/lib/contracts/process'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch contract
  const { data: contract, error: fetchError } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchError || !contract) {
    return Response.json({ error: 'Contract not found.' }, { status: 404 })
  }

  // Check ownership
  if (contract.user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check status
  if (contract.status === 'completed' || contract.status === 'processing') {
    return Response.json(
      { error: 'Contract has already been processed.' },
      { status: 400 }
    )
  }

  // Update status to processing
  await supabase
    .from('contracts')
    .update({ status: 'processing' })
    .eq('id', params.id)

  try {
    // Extract key terms
    const terms = await extractKeyTerms(contract, supabase)

    // Update status to completed
    await supabase
      .from('contracts')
      .update({ status: 'completed' })
      .eq('id', params.id)

    return Response.json({
      contract: { id: params.id, status: 'completed' },
      terms,
    })
  } catch (error) {
    // Update status to error
    await supabase
      .from('contracts')
      .update({ status: 'error' })
      .eq('id', params.id)

    return Response.json(
      { error: 'AI extraction failed. Please try again.' },
      { status: 500 }
    )
  }
}
```

---

## Processing Service

**File:** `lib/contracts/process.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { callExtractionAPI } from '@/lib/openai/client'
import { buildExtractionPrompt } from '@/lib/openai/prompts/extraction'
import { parseExtractionResponse } from '@/lib/openai/parse-response'
import { STANDARD_NDA_TERMS, STANDARD_MSA_TERMS } from '@/constants/terms'
import { Contract, KeyTerm } from '@/types'

export async function extractKeyTerms(
  contract: Contract,
  supabase: SupabaseClient
): Promise<KeyTerm[]> {
  // Get standard terms based on contract type
  const standardTerms = contract.type === 'nda'
    ? STANDARD_NDA_TERMS
    : STANDARD_MSA_TERMS

  // Get custom terms
  const { data: customTerms } = await supabase
    .from('custom_key_terms')
    .select('term_name')
    .eq('contract_id', contract.id)

  const customTermNames = customTerms?.map(t => t.term_name) || []

  // Build prompt
  const prompt = buildExtractionPrompt({
    contractText: contract.contract_text!,
    contractType: contract.type,
    standardTerms,
    customTerms: customTermNames,
  })

  // Call OpenAI
  const response = await callExtractionAPI(prompt)

  // Parse response
  const extractedTerms = parseExtractionResponse(response)

  // Store terms in database
  const termsToInsert = extractedTerms.map(term => ({
    contract_id: contract.id,
    term_name: term.term_name,
    value: term.value,
    page_number: term.page_number,
    confidence_score: term.confidence_score,
    source_sentence: term.source_sentence,
    is_manual: customTermNames.includes(term.term_name),
    is_edited: false,
    original_value: null,
  }))

  const { data: insertedTerms, error } = await supabase
    .from('key_terms')
    .insert(termsToInsert)
    .select()

  if (error) throw error

  return insertedTerms
}
```

---

## OpenAI Integration

### Client

**File:** `lib/openai/client.ts`

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function callExtractionAPI(prompt: string): Promise<string> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o'
  const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS_EXTRACTION || '2000')
  const temperature = parseFloat(process.env.OPENAI_TEMPERATURE_EXTRACTION || '0.1')

  // Retry logic with exponential backoff
  const maxRetries = 3
  const delays = [1000, 2000, 4000]

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: maxTokens,
        temperature,
      })

      return response.choices[0].message.content || ''
    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, delays[attempt]))
    }
  }

  throw new Error('Max retries exceeded')
}
```

### Extraction Prompt Builder

**File:** `lib/openai/prompts/extraction.ts`

```typescript
interface ExtractionPromptParams {
  contractText: string
  contractType: 'nda' | 'msa'
  standardTerms: string[]
  customTerms: string[]
}

export function buildExtractionPrompt(params: ExtractionPromptParams): string {
  const { contractText, contractType, standardTerms, customTerms } = params
  const allTerms = [...standardTerms, ...customTerms]

  return `You are a contract analysis expert. Extract the following key terms from this ${contractType.toUpperCase()} contract.

For EACH term, provide:
- term_name: The exact term name from the list below
- value: The extracted value (or null if not found)
- page_number: The page number where the term was found (look for [PAGE N] markers), or null if not found
- confidence_score: Your confidence in the extraction from 0.0 to 1.0
- source_sentence: The exact sentence from the contract containing this term (verbatim, max 200 chars), or null if not found

Terms to extract:
${allTerms.map((term, i) => `${i + 1}. ${term}`).join('\n')}

Important rules:
1. Only extract information explicitly stated in the contract
2. If a term is not found, set value, page_number, and source_sentence to null, and confidence_score to 0.0
3. The confidence_score should reflect how certain you are about the extraction:
   - 0.9-1.0: Term clearly stated, exact match found
   - 0.7-0.9: Term found but may require interpretation
   - 0.5-0.7: Term partially addressed or implied
   - 0.0-0.5: Term not clearly present or uncertain
4. Always include the source_sentence that contains the term
5. Page numbers are indicated by [PAGE N] markers in the text

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
```

### Response Parser

**File:** `lib/openai/parse-response.ts`

```typescript
import { z } from 'zod'

const extractedTermSchema = z.object({
  term_name: z.string(),
  value: z.string().nullable(),
  page_number: z.number().int().positive().nullable(),
  confidence_score: z.number().min(0).max(1),
  source_sentence: z.string().nullable(),
})

const extractionResponseSchema = z.object({
  terms: z.array(extractedTermSchema),
})

export type ExtractedTerm = z.infer<typeof extractedTermSchema>

export function parseExtractionResponse(response: string): ExtractedTerm[] {
  try {
    const parsed = JSON.parse(response)
    const validated = extractionResponseSchema.parse(parsed)
    return validated.terms
  } catch (error) {
    // If JSON parse fails, try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const validated = extractionResponseSchema.parse(parsed)
      return validated.terms
    }
    throw new Error('Invalid extraction response format')
  }
}
```

---

## Standard Terms

**File:** `constants/terms.ts`

```typescript
export const STANDARD_NDA_TERMS = [
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
]

export const STANDARD_MSA_TERMS = [
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
]
```

---

## Frontend Components

### ProcessingProgress Component

**File:** `components/contracts/processing-progress.tsx`

**Props:**
```typescript
interface ProcessingProgressProps {
  currentStep: 1 | 2 | 3
  error?: string
}
```

**Steps:**
1. Extracting text from PDF
2. Analysing with AI
3. Compiling results

**Features:**
- 3-step progress indicator
- Current step highlighted
- Completed steps show checkmark
- Error state with retry button

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Extraction latency (P95) | ≤ 30 seconds |
| OpenAI API call timeout | 20 seconds |
| Cost per extraction | ≤ $0.20 |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Contract already processed | Return 400 error |
| OpenAI API timeout | Retry up to 3 times with backoff |
| Invalid JSON response | Attempt to extract JSON, retry if fails |
| Term not found in contract | Return with value: null, confidence: 0.0 |
| Contract text too long | Truncate to 15,000 tokens (future: chunking) |
| Rate limit exceeded | Return error, suggest retry later |
| Empty contract text | Return 400 error |

---

## Acceptance Criteria

- [ ] Standard terms extracted based on contract type (NDA: 10, MSA: 12)
- [ ] Custom terms (if provided) included in extraction
- [ ] Each term includes: name, value, page number, confidence score, source sentence
- [ ] Extraction completes within 30 seconds P95
- [ ] Results stored in key_terms table
- [ ] Contract status updated to "completed" on success
- [ ] Contract status updated to "error" on failure
- [ ] "Not found" is a valid response for missing terms
