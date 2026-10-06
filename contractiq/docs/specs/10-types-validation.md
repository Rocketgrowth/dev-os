# Types & Validation Specification

## Overview

This document defines all TypeScript types and Zod validation schemas used throughout ContractIQ. Types are defined in the `types/` directory, and validation schemas in `lib/validation/schemas.ts`.

---

## TypeScript Types

### Contract Types

**File:** `types/contract.ts`

```typescript
export type ContractType = 'nda' | 'msa'

export type ContractStatus = 'pending' | 'processing' | 'completed' | 'error'

export interface Contract {
  id: string
  user_id: string
  name: string
  type: ContractType
  status: ContractStatus
  contract_text: string | null
  file_path: string | null
  file_url?: string | null  // Signed URL (not stored, generated on fetch)
  page_count: number | null
  created_at: string
  updated_at: string
}

export interface ContractWithTerms extends Contract {
  terms: KeyTerm[]
}

export interface CreateContractInput {
  name: string
  type: ContractType
  customTerms?: string[]
}

export interface ContractListItem {
  id: string
  name: string
  type: ContractType
  status: ContractStatus
  page_count: number | null
  created_at: string
}

export interface ContractStats {
  total: number
  nda: number
  msa: number
  pending: number
  processing: number
  completed: number
  error: number
}
```

### Key Term Types

**File:** `types/key-term.ts`

```typescript
export interface KeyTerm {
  id: string
  contract_id: string
  term_name: string
  value: string | null
  page_number: number | null
  confidence_score: number | null
  source_sentence: string | null
  is_manual: boolean
  is_edited: boolean
  original_value: string | null
  created_at: string
}

export interface ExtractedTerm {
  term_name: string
  value: string | null
  page_number: number | null
  confidence_score: number
  source_sentence: string | null
}

export interface EditTermInput {
  value: string
}
```

### Chat Types

**File:** `types/chat.ts`

```typescript
export type ChatRole = 'user' | 'assistant'

export interface ChatSession {
  id: string
  contract_id: string
  created_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: ChatRole
  content: string
  page_citation: number | null
  created_at: string
}

export interface SendMessageInput {
  message: string
}

export interface ChatHistory {
  session: ChatSession | null
  messages: ChatMessage[]
}
```

### Feedback Types

**File:** `types/feedback.ts`

```typescript
export type FeedbackRating = -1 | 1

export interface UserFeedback {
  id: string
  user_id: string
  contract_id: string
  rating: FeedbackRating
  comment: string | null
  created_at: string
}

export interface SubmitFeedbackInput {
  contract_id: string
  rating: FeedbackRating
  comment?: string
}
```

### API Types

**File:** `types/api.ts`

```typescript
// Generic API response wrapper
export interface ApiResponse<T> {
  data?: T
  error?: string
}

// Auth responses
export interface AuthUser {
  id: string
  email: string
}

export interface SignupResponse {
  user: AuthUser
}

export interface LoginResponse {
  user: AuthUser
}

export interface LogoutResponse {
  success: boolean
}

// Contract responses
export interface ContractUploadResponse {
  contract: ContractListItem
}

export interface ContractDetailResponse {
  contract: Contract
  terms: KeyTerm[]
}

export interface ContractListResponse {
  contracts: ContractListItem[]
  total: number
  stats: ContractStats
}

export interface ProcessContractResponse {
  contract: { id: string; status: ContractStatus }
  terms: KeyTerm[]
}

// Term responses
export interface EditTermResponse {
  term: KeyTerm
}

// Chat responses
export interface ChatHistoryResponse {
  session: ChatSession | null
  messages: ChatMessage[]
}

export interface SendMessageResponse {
  message: ChatMessage
}

// Feedback responses
export interface SubmitFeedbackResponse {
  feedback: {
    id: string
    created_at: string
  }
}
```

---

## Zod Validation Schemas

**File:** `lib/validation/schemas.ts`

```typescript
import { z } from 'zod'

// ============================================
// Auth Schemas
// ============================================

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>

// ============================================
// Contract Schemas
// ============================================

export const contractTypeSchema = z.enum(['nda', 'msa'])

export const uploadContractSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  type: contractTypeSchema,
  customTerms: z
    .array(z.string().min(1).max(100))
    .max(5, 'Maximum 5 custom terms allowed')
    .optional()
    .default([]),
})

export type UploadContractInput = z.infer<typeof uploadContractSchema>

// ============================================
// Key Term Schemas
// ============================================

export const editTermSchema = z.object({
  value: z.string(),
})

export type EditTermInput = z.infer<typeof editTermSchema>

// AI Extraction Response Schema
export const extractedTermSchema = z.object({
  term_name: z.string(),
  value: z.string().nullable(),
  page_number: z.number().int().positive().nullable(),
  confidence_score: z.number().min(0).max(1),
  source_sentence: z.string().nullable(),
})

export const extractionResponseSchema = z.object({
  terms: z.array(extractedTermSchema),
})

export type ExtractedTerm = z.infer<typeof extractedTermSchema>
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>

// ============================================
// Chat Schemas
// ============================================

export const sendMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(1000, 'Message too long. Maximum 1000 characters.'),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>

// ============================================
// Feedback Schemas
// ============================================

export const feedbackRatingSchema = z
  .number()
  .refine((v) => v === -1 || v === 1, {
    message: 'Invalid rating. Must be -1 or 1.',
  })

export const submitFeedbackSchema = z.object({
  contract_id: z.string().uuid('Invalid contract ID'),
  rating: feedbackRatingSchema,
  comment: z.string().max(1000, 'Comment too long').optional(),
})

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>

// ============================================
// Query Parameter Schemas
// ============================================

export const contractListQuerySchema = z.object({
  sort: z.enum(['created_at', 'name', 'type']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export type ContractListQuery = z.infer<typeof contractListQuerySchema>

// ============================================
// File Validation Schemas
// ============================================

export const pdfFileSchema = z.object({
  type: z.literal('application/pdf'),
  size: z.number().max(10 * 1024 * 1024, 'File size exceeds 10 MB limit'),
  name: z.string(),
})

export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Invalid file type. Only PDF files are allowed.' }
  }
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'File size exceeds 10 MB limit.' }
  }
  return { valid: true }
}
```

---

## Database Type Mapping

| TypeScript Type | PostgreSQL Type | Notes |
|-----------------|-----------------|-------|
| string (uuid) | uuid | gen_random_uuid() |
| string | text | - |
| number | integer | - |
| number (decimal) | numeric(3,2) | confidence_score |
| boolean | boolean | - |
| ContractType | contract_type (enum) | 'nda' \| 'msa' |
| ContractStatus | contract_status (enum) | 'pending' \| 'processing' \| 'completed' \| 'error' |
| ChatRole | chat_role (enum) | 'user' \| 'assistant' |
| Date string | timestamptz | ISO 8601 format |

---

## Supabase Type Generation

To generate types from Supabase schema:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

This generates types like:
```typescript
export type Database = {
  public: {
    Tables: {
      contracts: {
        Row: { ... }
        Insert: { ... }
        Update: { ... }
      }
      // ... other tables
    }
    Enums: {
      contract_type: 'nda' | 'msa'
      contract_status: 'pending' | 'processing' | 'completed' | 'error'
      chat_role: 'user' | 'assistant'
    }
  }
}
```

---

## Usage Examples

### API Route Validation

```typescript
import { signupSchema } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = signupSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  const { email, password } = parsed.data
  // ... continue with validated data
}
```

### Form Validation (Client)

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signupSchema, SignupInput } from '@/lib/validation/schemas'

function SignupForm() {
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = (data: SignupInput) => {
    // data is fully typed and validated
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* form fields */}
    </form>
  )
}
```

### Type-Safe Supabase Queries

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Contract, KeyTerm } from '@/types'

const supabase = await createClient()

const { data, error } = await supabase
  .from('contracts')
  .select('*')
  .eq('user_id', userId)
  .returns<Contract[]>()
```

---

## File Structure

```
types/
├── contract.ts       # Contract types
├── key-term.ts       # Key term types
├── chat.ts           # Chat types
├── feedback.ts       # Feedback types
├── api.ts            # API request/response types
└── index.ts          # Re-exports all types

lib/validation/
└── schemas.ts        # All Zod schemas
```

### Index Re-export

**File:** `types/index.ts`

```typescript
export * from './contract'
export * from './key-term'
export * from './chat'
export * from './feedback'
export * from './api'
```
