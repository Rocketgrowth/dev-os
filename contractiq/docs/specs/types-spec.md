# TypeScript Types Specification

## Overview

This spec defines all TypeScript types and interfaces used throughout the ContractIQ application.

---

## File Structure

```
src/types/
├── contract.ts     # Contract and key term types
├── chat.ts         # Chat session and message types
├── feedback.ts     # Feedback types
├── api.ts          # API request/response types
└── index.ts        # Re-exports all types
```

---

## Contract Types

### `src/types/contract.ts`

```typescript
// Contract type enum
export type ContractType = 'nda' | 'msa'

// Contract status enum
export type ContractStatus = 'pending' | 'processing' | 'completed' | 'error'

// Contract entity
export interface Contract {
  id: string
  user_id: string
  name: string
  type: ContractType
  status: ContractStatus
  contract_text: string | null
  file_path: string | null
  page_count: number | null
  created_at: string
  updated_at: string
}

// Contract with file URL (from API)
export interface ContractWithUrl extends Contract {
  file_url: string | null
}

// Contract list item (summary)
export interface ContractListItem {
  id: string
  name: string
  type: ContractType
  status: ContractStatus
  page_count: number | null
  created_at: string
}

// Key term entity
export interface KeyTerm {
  id: string
  contract_id: string
  term_name: string
  value: string | null
  page_number: number | null
  confidence_score: number
  source_sentence: string | null
  is_manual: boolean
  is_edited: boolean
  original_value: string | null
  created_at: string
}

// Custom key term (user-defined, before processing)
export interface CustomKeyTerm {
  id: string
  contract_id: string
  term_name: string
  created_at: string
}

// Contract with key terms (from API)
export interface ContractWithTerms extends ContractWithUrl {
  key_terms: KeyTerm[]
}

// Standard term definitions
export interface StandardTermDefinition {
  name: string
  description: string
}

export const NDA_TERMS: StandardTermDefinition[] = [
  { name: 'Parties', description: 'Names of the contracting parties' },
  { name: 'Effective Date', description: 'When the agreement takes effect' },
  { name: 'Confidentiality Obligations', description: 'What must be kept confidential' },
  { name: 'Permitted Disclosures', description: 'Allowed exceptions to confidentiality' },
  { name: 'Term & Duration', description: 'How long the agreement lasts' },
  { name: 'Governing Law', description: "Which jurisdiction's laws apply" },
  { name: 'Jurisdiction', description: 'Where disputes will be resolved' },
  { name: 'IP Ownership', description: 'Who owns intellectual property' },
  { name: 'Non-Solicitation', description: 'Restrictions on hiring/soliciting' },
  { name: 'Breach & Remedy', description: 'What happens if agreement is breached' },
]

export const MSA_TERMS: StandardTermDefinition[] = [
  { name: 'Parties', description: 'Names of the contracting parties' },
  { name: 'Service Scope', description: 'Description of services provided' },
  { name: 'Payment Terms', description: 'How and when payments are made' },
  { name: 'Invoice Schedule', description: 'Timing of invoices' },
  { name: 'Late Payment Penalty', description: 'Fees for late payments' },
  { name: 'Liability Cap', description: 'Maximum liability amount' },
  { name: 'Indemnification', description: 'Who indemnifies whom and for what' },
  { name: 'IP Ownership', description: 'Who owns intellectual property' },
  { name: 'Termination Clause', description: 'How the agreement can be ended' },
  { name: 'Governing Law', description: "Which jurisdiction's laws apply" },
  { name: 'Dispute Resolution', description: 'How disputes are handled' },
  { name: 'Notice Period', description: 'Required notice for termination' },
]
```

---

## Chat Types

### `src/types/chat.ts`

```typescript
// Chat message role
export type ChatRole = 'user' | 'assistant'

// Chat session entity
export interface ChatSession {
  id: string
  contract_id: string
  created_at: string
}

// Chat message entity
export interface ChatMessage {
  id: string
  session_id: string
  role: ChatRole
  content: string
  page_citation: number | null
  created_at: string
}

// Chat session with messages
export interface ChatSessionWithMessages extends ChatSession {
  messages: ChatMessage[]
}
```

---

## Feedback Types

### `src/types/feedback.ts`

```typescript
// Feedback rating
export type FeedbackRating = 1 | -1

// Feedback entity
export interface UserFeedback {
  id: string
  user_id: string
  contract_id: string
  rating: FeedbackRating
  comment: string | null
  created_at: string
}
```

---

## API Types

### `src/types/api.ts`

```typescript
import type { Contract, ContractListItem, ContractWithTerms, KeyTerm } from './contract'
import type { ChatMessage, ChatSession } from './chat'
import type { UserFeedback } from './feedback'

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

export interface SignUpResponse {
  user: AuthUser
}

export interface SignInResponse {
  user: AuthUser
}

export interface SignOutResponse {
  success: boolean
}

// Contract responses
export interface ListContractsResponse {
  contracts: ContractListItem[]
  total: number
}

export interface UploadContractResponse {
  contract: ContractListItem
}

export interface GetContractResponse {
  contract: ContractWithTerms
  terms: KeyTerm[]
}

export interface ProcessContractResponse {
  contract: {
    id: string
    status: 'completed'
  }
  terms: KeyTerm[]
}

export interface DeleteContractResponse {
  success: boolean
}

// Term responses
export interface UpdateTermResponse {
  term: KeyTerm
}

// Chat responses
export interface GetChatResponse {
  session: ChatSession
  messages: ChatMessage[]
}

export interface SendChatResponse {
  message: ChatMessage
}

// Feedback responses
export interface SubmitFeedbackResponse {
  feedback: {
    id: string
    created_at: string
  }
}

// Request types
export interface SignUpRequest {
  email: string
  password: string
}

export interface SignInRequest {
  email: string
  password: string
}

export interface UploadContractRequest {
  file: File
  name?: string
  type: 'nda' | 'msa'
  customTerms?: string[]
}

export interface SendChatRequest {
  message: string
}

export interface UpdateTermRequest {
  value: string
}

export interface SubmitFeedbackRequest {
  contract_id: string
  rating: '1' | '-1'
  comment?: string
}

// Query params
export interface ListContractsParams {
  sort?: 'name' | 'type' | 'status' | 'created_at'
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}
```

---

## Index Export

### `src/types/index.ts`

```typescript
export * from './contract'
export * from './chat'
export * from './feedback'
export * from './api'
```

---

## Database Types (Supabase)

Generate types from Supabase schema:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
```

### Example Generated Types

```typescript
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      contracts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'nda' | 'msa'
          status: 'pending' | 'processing' | 'completed' | 'error'
          contract_text: string | null
          file_path: string | null
          page_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'nda' | 'msa'
          status?: 'pending' | 'processing' | 'completed' | 'error'
          contract_text?: string | null
          file_path?: string | null
          page_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'nda' | 'msa'
          status?: 'pending' | 'processing' | 'completed' | 'error'
          contract_text?: string | null
          file_path?: string | null
          page_count?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      key_terms: {
        Row: {
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
        Insert: {
          id?: string
          contract_id: string
          term_name: string
          value?: string | null
          page_number?: number | null
          confidence_score?: number | null
          source_sentence?: string | null
          is_manual?: boolean
          is_edited?: boolean
          original_value?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          term_name?: string
          value?: string | null
          page_number?: number | null
          confidence_score?: number | null
          source_sentence?: string | null
          is_manual?: boolean
          is_edited?: boolean
          original_value?: string | null
          created_at?: string
        }
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

## Type Utilities

### `src/lib/utils/types.ts`

```typescript
// Extract row type from Supabase table
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

// Extract insert type from Supabase table
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

// Extract update type from Supabase table
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Extract enum type
export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]
```

---

## Acceptance Criteria

- [ ] All types are defined and exported
- [ ] Types match database schema exactly
- [ ] API request/response types are complete
- [ ] Supabase types are generated from schema
- [ ] Type utilities are available
- [ ] No `any` types in production code
- [ ] All components use proper types
- [ ] All API routes use proper types
