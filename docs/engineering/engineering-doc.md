# ContractIQ — Engineering Document

**Version:** 1.0
**Date:** August 19, 2026
**Status:** Draft
**Source:** ContractIQ PRD v1.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Scope](#2-product-scope)
3. [User Personas](#3-user-personas)
4. [User Flows](#4-user-flows)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Backend Architecture](#6-backend-architecture)
7. [Database Design](#7-database-design)
8. [AI Architecture](#8-ai-architecture)
9. [API Specification](#9-api-specification)
10. [Feature Breakdown](#10-feature-breakdown)
11. [Folder Structure](#11-folder-structure)
12. [Naming Conventions](#12-naming-conventions)
13. [Testing Strategy](#13-testing-strategy)
14. [Specs to Implementation Mapping](#14-specs-to-implementation-mapping)

---

## 1. Executive Summary

### Project Name
ContractIQ

### Business Goal
Reduce NDA and MSA contract review time from 90+ minutes (manual review) to 15 minutes or less using AI-powered key term extraction and document chat.

### Problem Statement
Business professionals — founders, operations managers, and procurement leads — routinely sign NDAs and MSAs without fully understanding the terms. Without in-house legal teams, reviewing contracts is time-consuming, requires legal expertise most SMBs lack, and frequently results in missed obligations, unfavourable terms, or costly disputes. Existing tools require legal training or produce generic summaries without page-level attribution or confidence scoring.

### Target Users
- **Primary:** Time-Pressed Founders / Operations Leads (5-250 employees, no in-house legal counsel, 5-15 contracts/month)
- **Secondary:** Freelancers / Consultants (1-4 contracts/month from larger clients)

### Success Criteria

| Metric | Target |
|--------|--------|
| Key-term extraction accuracy (F1) | ≥ 88% on NDA/MSA test set |
| Time to first extracted key-term display | ≤ 30 seconds P95 for contracts ≤ 20 pages |
| Confidence score calibration | Predicted confidence within ±10% of actual accuracy |
| Cost per contract analysis | ≤ $0.25 per 20-page contract |
| 30-day user retention | ≥ 45% |
| AI extraction correction rate | ≤ 12% of terms manually corrected |

---

## 2. Product Scope

### In Scope (MVP)

- Email/password authentication via Supabase Auth
- PDF upload (max 10 MB, max 20 pages, text-layer PDFs only)
- Contract type selection (NDA or MSA)
- Key term extraction using GPT-4o with:
  - Term name, extracted value, page number, confidence score, source sentence
  - Standard terms for NDA (10 terms) and MSA (12 terms)
- Custom term addition (up to 5 terms per analysis)
- Confidence scoring with colour-coded display (green ≥80%, amber 50-79%, red <50%)
- Low-confidence warnings with verification prompts
- Inline PDF viewer with page navigation (PDF.js)
- Text viewer fallback when Storage is unavailable
- Click-to-navigate from key terms to PDF page
- Contract chat (Q&A grounded in document text)
- Mandatory page citations on chat responses
- Persistent chat history per contract
- Dashboard with contract history (sortable list)
- Inline key term editing with original value preservation
- Feedback collection (thumbs up/down + optional comment)
- "Not legal advice" disclaimer on all results

### Out of Scope (MVP)

- Scanned/image PDFs (OCR) — planned for v1.2
- Non-English contracts
- Non-NDA/MSA contract types
- Batch upload (multiple contracts)
- Team workspaces / multi-user seats
- Export to CSV/PDF — planned for v1.1
- Contract comparison view
- Email notifications
- API access for third-party integrations
- Mobile native apps

### Future Enhancements

| Version | Features |
|---------|----------|
| v1.1 | Export key terms to CSV, Export summary to PDF, Batch upload (up to 5 contracts), Dashboard analytics |
| v1.2 | Scanned PDF support (OCR via AWS Textract), Contract comparison view, Email notifications, Multi-user workspace |

---

## 3. User Personas

### Primary Persona: Time-Pressed Founder / Ops Lead

| Attribute | Details |
|-----------|---------|
| Role | Founder, COO, Procurement Manager, Legal Operations Manager |
| Company Size | 5-250 employees |
| Industry | SaaS, agency, professional services, fintech, e-commerce |
| Contract Volume | 5-15 NDAs or MSAs per month |
| Current Behaviour | 90-120 minutes per contract review; relies on Google searches or expensive ad-hoc legal consultations |
| Pain Points | Time spent, missed obligations (auto-renewal, indemnification limits, IP assignment), $250-$500/hr for lawyer review |
| Permissions | Full access to own contracts only (RLS enforced) |
| Primary Workflows | Upload contract → Review extracted terms → Edit corrections → Chat for clarification → Mark review complete |

### Secondary Persona: Freelancer / Consultant

| Attribute | Details |
|-----------|---------|
| Role | Individual contributor (designer, developer, marketer, consultant) |
| Contract Volume | 1-4 MSAs per month from larger clients |
| Current Behaviour | Often signs without reading carefully due to power imbalance |
| Pain Points | Cannot afford legal review; unsure which clauses are non-standard or risky |
| Permissions | Full access to own contracts only (RLS enforced) |
| Primary Workflows | Upload contract → Identify risky clauses → Chat to understand implications |

---

## 4. User Flows

### Flow 1: New Visitor → Sign Up → Dashboard

```
User lands on Landing Page
    → Clicks "Get Started Free"
    → Frontend: Opens Supabase Auth sign-up modal (email + password)
    → Backend: Supabase Auth creates user record
    → Database: User row created in auth.users
    → System Response: Redirect to /dashboard
    → Frontend: Dashboard renders empty state ("No contracts reviewed yet")
```

### Flow 2: Returning User → Sign In → Dashboard

```
User lands on Landing Page
    → Clicks "Sign In"
    → Frontend: Opens Supabase Auth sign-in modal
    → Backend: Supabase Auth validates credentials, returns session
    → Database: Session token stored in browser
    → System Response: Redirect to /dashboard
    → Frontend: Dashboard renders with contract history (if exists)
```

### Flow 3: Contract Review (Core Flow)

```
User clicks "Review Contract" on Dashboard
    → Frontend: Navigates to /upload
    → User selects contract type (NDA/MSA) from dropdown
    → User drags/drops or file-picks a PDF
    → Frontend: Validates file (≤10MB, ≤20 pages, PDF extension)
    → Frontend: Shows pre-processing preview (standard terms for selected type)
    → User optionally adds custom terms (up to 5) via "+ Add Key Term"
    → User clicks "Process Contract"

    → Frontend: Shows progress indicator (Step 1: Extracting text)
    → Backend: POST /api/contracts/upload
        → pdf-parse extracts text with [PAGE N] markers
        → Stores PDF in Supabase Storage: contracts/{user_id}/{contract_id}/{filename}.pdf
        → Stores extracted text in contracts.contract_text
        → Returns contract_id
    → Database: INSERT into contracts table

    → Frontend: Progress indicator (Step 2: Analysing with AI)
    → Backend: POST /api/contracts/[id]/process
        → Reads contract_text from DB
        → Builds prompt with standard terms + custom terms
        → Calls OpenAI GPT-4o (JSON mode, temp 0.1)
        → Parses JSON response
        → Validates and stores key terms
    → Database: INSERT into key_terms table (one row per term)
    → Database: UPDATE contracts.status = 'completed'

    → Frontend: Progress indicator (Step 3: Compiling results)
    → System Response: Redirect to /contracts/[id]
    → Frontend: Renders two-panel layout:
        → Left: PDF viewer (or text fallback)
        → Right: Key terms panel with values, pages, confidence scores
```

### Flow 4: Chat with Contract

```
User on Results Page (/contracts/[id])
    → Clicks "Chat" tab or floating button
    → Frontend: Opens chat interface (right panel or slide-out)
    → User types question (e.g., "What happens if I breach the NDA?")

    → Frontend: Appends user message to chat UI
    → Backend: POST /api/contracts/[id]/chat
        → Fetches contract_text from DB
        → Fetches conversation history from chat_messages (up to 200 messages)
        → Builds system prompt: "Answer only from the document text provided..."
        → Calls OpenAI GPT-4o (temp 0.4)
        → Parses response, extracts [Page X] citation
    → Database: INSERT user message into chat_messages
    → Database: INSERT assistant message into chat_messages

    → System Response: Returns assistant message with page citation
    → Frontend: Renders assistant message with clickable page link
    → User clicks page citation
    → Frontend: Scrolls PDF viewer to cited page
```

### Flow 5: Inline Term Editing

```
User on Results Page (/contracts/[id])
    → Clicks "Edit" on a key term
    → Frontend: Shows inline edit input with current value
    → User modifies value, clicks "Save"

    → Frontend: Optimistic update to UI
    → Backend: PATCH /api/contracts/[id]/terms/[termId]
        → Validates new value
        → Stores original_value (if first edit)
        → Updates value
        → Sets is_edited = true
    → Database: UPDATE key_terms row

    → System Response: Returns updated term
    → Frontend: Shows "Edited" badge on term
```

### Flow 6: Feedback Submission

```
User on Results Page (/contracts/[id])
    → Clicks thumbs up or thumbs down
    → Optionally enters a text comment
    → Clicks "Submit Feedback"

    → Backend: POST /api/feedback
        → Validates rating (1 or -1)
        → Stores feedback with user_id and contract_id
    → Database: INSERT into user_feedback table

    → System Response: Returns success
    → Frontend: Shows "Thank you for your feedback"
```

---

## 5. Frontend Architecture

### Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| State Management | React Context + TanStack Query (React Query) |
| PDF Rendering | PDF.js (client-side) |
| Forms | React Hook Form + Zod validation |
| Auth | Supabase Auth (client-side SDK) |

### Page Hierarchy

```
app/
├── (marketing)/
│   └── page.tsx                    # Landing page (public)
├── (auth)/
│   ├── login/page.tsx              # Sign in page
│   ├── signup/page.tsx             # Sign up page
│   └── layout.tsx                  # Auth layout (centered card)
├── (dashboard)/
│   ├── layout.tsx                  # Protected layout with sidebar/header
│   ├── page.tsx                    # Dashboard (contract list)
│   ├── upload/page.tsx             # Contract upload wizard
│   └── contracts/
│       └── [id]/
│           ├── page.tsx            # Results page (PDF + key terms + chat)
│           └── loading.tsx         # Skeleton loader
└── api/                            # API routes (see Backend section)
```

### Component Hierarchy

```
components/
├── ui/                             # shadcn/ui primitives
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── input.tsx
│   ├── badge.tsx
│   ├── tooltip.tsx
│   ├── progress.tsx
│   └── ...
├── layout/
│   ├── header.tsx                  # App header with user menu
│   ├── sidebar.tsx                 # Dashboard sidebar nav
│   └── footer.tsx                  # Marketing footer
├── auth/
│   ├── auth-form.tsx               # Reusable auth form (login/signup)
│   └── user-menu.tsx               # User dropdown (sign out, settings)
├── contracts/
│   ├── contract-list.tsx           # Dashboard contract table
│   ├── contract-card.tsx           # Single contract summary card
│   ├── upload-dropzone.tsx         # Drag-and-drop upload zone
│   ├── contract-type-selector.tsx  # NDA/MSA dropdown
│   ├── custom-term-input.tsx       # Add custom term input
│   ├── processing-progress.tsx     # 3-step progress indicator
│   ├── pdf-viewer.tsx              # PDF.js wrapper component
│   ├── text-viewer.tsx             # Fallback paginated text viewer
│   ├── key-terms-panel.tsx         # Right panel with all terms
│   ├── key-term-row.tsx            # Single term with edit/expand
│   ├── confidence-badge.tsx        # Colour-coded confidence score
│   └── source-sentence.tsx         # Expandable "Why?" section
├── chat/
│   ├── chat-interface.tsx          # Chat container
│   ├── chat-message.tsx            # Single message bubble
│   ├── chat-input.tsx              # Message input with send button
│   └── page-citation.tsx           # Clickable [Page X] link
├── feedback/
│   └── feedback-form.tsx           # Thumbs up/down + comment
└── shared/
    ├── loading-spinner.tsx
    ├── empty-state.tsx
    ├── error-boundary.tsx
    └── disclaimer.tsx              # "Not legal advice" banner
```

### UX States

| State | Implementation |
|-------|----------------|
| Loading | Skeleton loaders for lists and panels; Progress indicator for processing |
| Empty | Illustrated empty states with CTA ("Upload your first contract") |
| Error | Toast notifications for recoverable errors; Full-page error for critical failures with retry CTA |
| Responsive | Mobile-first; PDF viewer hidden on mobile (text viewer only); Key terms as collapsible accordion |
| Accessibility | WCAG 2.1 AA; Focus management; ARIA labels; Keyboard navigation for all interactions |

### State Management

| State Type | Solution |
|------------|----------|
| Server State | TanStack Query (contracts, key terms, chat messages) |
| Auth State | Supabase Auth context (user session) |
| UI State | React useState/useReducer (modals, expanded sections) |
| Form State | React Hook Form (upload form, edit form, feedback form) |

---

## 6. Backend Architecture

### Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (Next.js API Routes) |
| Framework | Next.js 14 App Router (Route Handlers) |
| Language | TypeScript |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| File Storage | Supabase Storage |
| AI/LLM | OpenAI API (GPT-4o) |
| PDF Parsing | pdf-parse (Node.js library) |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│                       (Next.js App Router)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Landing    │  │    Auth     │  │  Dashboard  │  │   Results   │    │
│  │    Page     │  │   Pages     │  │    Page     │  │    Page     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    API ROUTES         │
                    │  (Route Handlers)     │
                    ├───────────────────────┤
                    │ /api/auth/*           │
                    │ /api/contracts/*      │
                    │ /api/feedback         │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   SUPABASE    │      │    OPENAI     │      │   pdf-parse   │
│               │      │     API       │      │   (Node.js)   │
├───────────────┤      ├───────────────┤      └───────────────┘
│ Auth          │      │ GPT-4o        │
│ PostgreSQL    │      │ - Extraction  │
│ Storage       │      │ - Chat Q&A    │
│ RLS Policies  │      └───────────────┘
└───────────────┘
```

### Core Systems

| System | Implementation |
|--------|----------------|
| Authentication | Supabase Auth with email/password; Session tokens in cookies; Middleware validates session on protected routes |
| Authorization | Supabase RLS policies on all tables; `user_id = auth.uid()` check; No cross-user data access |
| Business Logic | Thin API routes; Logic in service modules (`lib/contracts/`, `lib/openai/`) |
| Validation | Zod schemas for all request bodies; File validation (size, type, page count) |
| Middleware | Auth middleware for protected routes; Rate limiting middleware (10 requests/minute per user on AI endpoints) |
| Error Handling | Centralized error handler; Structured error responses with codes; OpenAI retries (3 attempts with exponential backoff) |

### Service Modules

```
lib/
├── supabase/
│   ├── client.ts           # Supabase client (browser)
│   ├── server.ts           # Supabase client (server/API routes)
│   └── admin.ts            # Supabase admin client (service role)
├── openai/
│   ├── client.ts           # OpenAI client initialization
│   ├── prompts/
│   │   ├── extraction.ts   # Key term extraction prompt builder
│   │   └── chat.ts         # Chat Q&A prompt builder
│   └── parse-response.ts   # JSON response parser with validation
├── pdf/
│   └── extract-text.ts     # pdf-parse wrapper with page markers
├── contracts/
│   ├── upload.ts           # Upload and text extraction logic
│   ├── process.ts          # AI extraction orchestration
│   └── terms.ts            # Key term CRUD operations
└── validation/
    └── schemas.ts          # Zod schemas for all entities
```

---

## 7. Database Design

### Overview

All tables are stored in a single Supabase PostgreSQL database with Row Level Security (RLS) enabled. Every table with user data has a `user_id` foreign key and RLS policies restricting access to `auth.uid()`.

### Entity Relationship Diagram

```
┌─────────────────┐
│   auth.users    │ (Supabase managed)
│   (id: uuid)    │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────┐
│                        contracts                             │
│  id, user_id, name, type, status, contract_text, file_path  │
└─────────────────┬───────────────────────────────────────────┘
                  │
     ┌────────────┼────────────┬────────────────┐
     │ 1:N        │ 1:N        │ 1:N            │
     ▼            ▼            ▼                ▼
┌──────────┐ ┌────────────┐ ┌──────────────┐ ┌──────────────┐
│key_terms │ │custom_key_ │ │chat_sessions │ │user_feedback │
│          │ │   terms    │ │              │ │              │
└──────────┘ └────────────┘ └──────┬───────┘ └──────────────┘
                                   │ 1:N
                                   ▼
                           ┌──────────────┐
                           │chat_messages │
                           └──────────────┘
```

### Table: `contracts`

Stores uploaded contracts with extracted text.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Contract unique identifier |
| user_id | uuid | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | Owner of the contract |
| name | text | NOT NULL | Original filename or user-provided name |
| type | text | NOT NULL, CHECK (type IN ('nda', 'msa')) | Contract type |
| status | text | NOT NULL DEFAULT 'pending', CHECK (status IN ('pending', 'processing', 'completed', 'error')) | Processing status |
| contract_text | text | | Extracted text with [PAGE N] markers |
| file_path | text | | Supabase Storage path (nullable if upload fails) |
| page_count | integer | | Number of pages in the PDF |
| created_at | timestamptz | NOT NULL DEFAULT now() | Upload timestamp |
| updated_at | timestamptz | NOT NULL DEFAULT now() | Last update timestamp |

**Indexes:**
- `idx_contracts_user_id` on `user_id`
- `idx_contracts_created_at` on `created_at DESC`

**RLS Policy:**
```sql
CREATE POLICY "Users can only access their own contracts"
ON contracts FOR ALL
USING (user_id = auth.uid());
```

### Table: `key_terms`

Stores extracted key terms for each contract.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Term unique identifier |
| contract_id | uuid | NOT NULL, REFERENCES contracts(id) ON DELETE CASCADE | Parent contract |
| term_name | text | NOT NULL | Name of the key term (e.g., "Governing Law") |
| value | text | | Extracted value (nullable if not found) |
| page_number | integer | | 1-indexed page where term was found |
| confidence_score | numeric(3,2) | CHECK (confidence_score >= 0 AND confidence_score <= 1) | AI confidence (0.00-1.00) |
| source_sentence | text | | Verbatim sentence from contract |
| is_manual | boolean | NOT NULL DEFAULT false | True if this is a custom user term |
| is_edited | boolean | NOT NULL DEFAULT false | True if user edited the value |
| original_value | text | | Original AI-extracted value (preserved on edit) |
| created_at | timestamptz | NOT NULL DEFAULT now() | Extraction timestamp |

**Indexes:**
- `idx_key_terms_contract_id` on `contract_id`

**RLS Policy:**
```sql
CREATE POLICY "Users can only access key terms for their own contracts"
ON key_terms FOR ALL
USING (
  contract_id IN (
    SELECT id FROM contracts WHERE user_id = auth.uid()
  )
);
```

### Table: `custom_key_terms`

Stores user-defined terms to extract (before processing).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Custom term unique identifier |
| contract_id | uuid | NOT NULL, REFERENCES contracts(id) ON DELETE CASCADE | Parent contract |
| term_name | text | NOT NULL | User-provided term name |
| created_at | timestamptz | NOT NULL DEFAULT now() | Creation timestamp |

**Indexes:**
- `idx_custom_key_terms_contract_id` on `contract_id`

**RLS Policy:**
```sql
CREATE POLICY "Users can only access custom terms for their own contracts"
ON custom_key_terms FOR ALL
USING (
  contract_id IN (
    SELECT id FROM contracts WHERE user_id = auth.uid()
  )
);
```

### Table: `chat_sessions`

Stores chat sessions per contract.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Session unique identifier |
| contract_id | uuid | NOT NULL, REFERENCES contracts(id) ON DELETE CASCADE | Parent contract |
| created_at | timestamptz | NOT NULL DEFAULT now() | Session start timestamp |

**Indexes:**
- `idx_chat_sessions_contract_id` on `contract_id`

**RLS Policy:**
```sql
CREATE POLICY "Users can only access chat sessions for their own contracts"
ON chat_sessions FOR ALL
USING (
  contract_id IN (
    SELECT id FROM contracts WHERE user_id = auth.uid()
  )
);
```

### Table: `chat_messages`

Stores individual chat messages.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Message unique identifier |
| session_id | uuid | NOT NULL, REFERENCES chat_sessions(id) ON DELETE CASCADE | Parent session |
| role | text | NOT NULL, CHECK (role IN ('user', 'assistant')) | Message sender |
| content | text | NOT NULL | Message content |
| page_citation | integer | | Page number cited in response (for assistant messages) |
| created_at | timestamptz | NOT NULL DEFAULT now() | Message timestamp |

**Indexes:**
- `idx_chat_messages_session_id` on `session_id`
- `idx_chat_messages_created_at` on `created_at ASC`

**RLS Policy:**
```sql
CREATE POLICY "Users can only access chat messages for their own sessions"
ON chat_messages FOR ALL
USING (
  session_id IN (
    SELECT cs.id FROM chat_sessions cs
    JOIN contracts c ON cs.contract_id = c.id
    WHERE c.user_id = auth.uid()
  )
);
```

### Table: `user_feedback`

Stores user feedback on contract analyses.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Feedback unique identifier |
| user_id | uuid | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE | User who submitted |
| contract_id | uuid | NOT NULL, REFERENCES contracts(id) ON DELETE CASCADE | Contract being rated |
| rating | integer | NOT NULL, CHECK (rating IN (-1, 1)) | Thumbs down (-1) or up (1) |
| comment | text | | Optional text comment |
| created_at | timestamptz | NOT NULL DEFAULT now() | Submission timestamp |

**Indexes:**
- `idx_user_feedback_contract_id` on `contract_id`

**RLS Policy:**
```sql
CREATE POLICY "Users can only access their own feedback"
ON user_feedback FOR ALL
USING (user_id = auth.uid());
```

### Supabase Storage

**Bucket:** `contracts`

**Path Pattern:** `contracts/{user_id}/{contract_id}/{filename}.pdf`

**Storage RLS Policies:**
```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false);

-- INSERT policy (upload)
CREATE POLICY "Users can upload their own contracts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contracts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT policy (download/view)
CREATE POLICY "Users can view their own contracts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE policy
CREATE POLICY "Users can delete their own contracts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contracts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## 8. AI Architecture

### Provider and Model

| Setting | Value | Rationale |
|---------|-------|-----------|
| Provider | OpenAI | Best-in-class legal text understanding; JSON mode support |
| Model | GPT-4o | 128k context window; high accuracy on legal documents |
| Context Window | 128,000 tokens | Supports contracts up to 15,000 tokens with room for prompt and history |

### Key Term Extraction

| Setting | Value |
|---------|-------|
| Prompt Technique | Few-shot (3 NDA examples, 3 MSA examples) |
| Response Format | JSON mode (`response_format: { type: "json_object" }`) |
| Temperature | 0.1 (deterministic extraction) |
| Max Output Tokens | 2,000 |
| Latency Target | ≤ 20 seconds per call |
| Cost Target | ≤ $0.20 per 20-page contract |

**Output Schema:**
```json
{
  "terms": [
    {
      "term_name": "string",
      "value": "string | null",
      "page_number": "integer | null",
      "confidence_score": "float (0.0-1.0)",
      "source_sentence": "string | null"
    }
  ]
}
```

**Standard Terms - NDA:**
1. Parties
2. Effective Date
3. Confidentiality Obligations
4. Permitted Disclosures
5. Term & Duration
6. Governing Law
7. Jurisdiction
8. IP Ownership
9. Non-Solicitation
10. Breach & Remedy

**Standard Terms - MSA:**
1. Parties
2. Service Scope
3. Payment Terms
4. Invoice Schedule
5. Late Payment Penalty
6. Liability Cap
7. Indemnification
8. IP Ownership
9. Termination Clause
10. Governing Law
11. Dispute Resolution
12. Notice Period

### Contract Chat (Q&A)

| Setting | Value |
|---------|-------|
| Prompt Technique | Full-context RAG (entire contract as context) |
| Temperature | 0.4 (natural but focused responses) |
| Max Output Tokens | 1,000 |
| Latency Target | ≤ 15 seconds per response |
| Cost Target | ≤ $0.05 per chat turn |

**System Prompt (Summary):**
```
You are a contract analysis assistant. Answer questions using ONLY the contract text provided below. Do not use any external knowledge.

Rules:
1. If the answer is in the document, provide it with a [Page X] citation
2. If the answer is NOT in the document, respond: "I cannot find this information in the document."
3. Always prefix your answer with "Based on the document..."
4. Be concise and direct

Contract Text:
{contract_text}
```

**Conversation Memory:**
- Full conversation history passed on each turn (up to 200 messages)
- Enables memory-style questions ("what did you say earlier about X?")

### Guardrails and Fallbacks

| Guardrail | Implementation |
|-----------|----------------|
| Confidence Scoring | Model self-reports 0.0-1.0 per term; displayed to user |
| Source Sentence | Every term includes verbatim source; enables verification |
| Low Confidence Warning | Terms with confidence < 50% show ⚠️ and tooltip |
| "Not Found" as Valid | "I cannot find this in the document" is a correct response |
| JSON Parse Retry | If JSON invalid, retry with: "Your previous response was not valid JSON. Return only the JSON array." |
| API Error Retry | 3 retries with exponential backoff (1s, 2s, 4s) |
| Timeout | 20 seconds per OpenAI call; surface error to user after failure |

### Cost Controls

| Control | Implementation |
|---------|----------------|
| Token Monitoring | Log input/output tokens per call |
| Cost Alerting | Alert at 80% of monthly budget |
| Contract Length Limit | Reject contracts > 15,000 tokens |
| Rate Limiting | 10 AI requests per user per minute |

---

## 9. API Specification

### Authentication

All protected endpoints require a valid Supabase session. Auth is handled via cookies set by Supabase Auth.

### Endpoints

#### POST /api/auth/signup

**Purpose:** Create a new user account

**Auth Required:** No

**Request Body:**
```json
{
  "email": "string (email format)",
  "password": "string (min 8 chars)"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "string"
  }
}
```

**Error Responses:**
- 400: Invalid email or password format
- 409: Email already registered

---

#### POST /api/auth/login

**Purpose:** Sign in an existing user

**Auth Required:** No

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "string"
  }
}
```

**Error Responses:**
- 401: Invalid credentials

---

#### POST /api/auth/logout

**Purpose:** Sign out the current user

**Auth Required:** Yes

**Response (200):**
```json
{
  "success": true
}
```

---

#### POST /api/contracts/upload

**Purpose:** Upload a PDF and extract text

**Auth Required:** Yes

**Request Body:** `multipart/form-data`
```
file: File (PDF, max 10MB)
name: string (optional, defaults to filename)
type: "nda" | "msa"
customTerms: string[] (optional, max 5)
```

**Validation Rules:**
- File must be PDF (application/pdf)
- File size ≤ 10 MB
- Page count ≤ 20 (validated after parsing)
- Extracted text ≥ 100 words (rejects scanned PDFs)

**Response (201):**
```json
{
  "contract": {
    "id": "uuid",
    "name": "string",
    "type": "nda" | "msa",
    "status": "pending",
    "page_count": 12,
    "created_at": "ISO timestamp"
  }
}
```

**Error Responses:**
- 400: Invalid file type, file too large, too many pages
- 400: Scanned PDF (extracted text < 100 words)
- 413: File size exceeds limit
- 500: Storage upload failed (non-blocking; continues without file_path)

---

#### POST /api/contracts/[id]/process

**Purpose:** Run AI key term extraction on a contract

**Auth Required:** Yes

**Request Body:** None (uses stored contract_text)

**Response (200):**
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
- 404: Contract not found
- 403: Contract belongs to another user
- 400: Contract already processed
- 500: OpenAI API error (after retries)

---

#### GET /api/contracts

**Purpose:** List all contracts for the current user

**Auth Required:** Yes

**Query Parameters:**
- `sort`: "created_at" | "name" | "type" (default: "created_at")
- `order`: "asc" | "desc" (default: "desc")
- `limit`: integer (default: 50, max: 100)
- `offset`: integer (default: 0)

**Response (200):**
```json
{
  "contracts": [
    {
      "id": "uuid",
      "name": "Vendor NDA - Acme Corp",
      "type": "nda",
      "status": "completed",
      "page_count": 8,
      "created_at": "ISO timestamp"
    }
  ],
  "total": 42
}
```

---

#### GET /api/contracts/[id]

**Purpose:** Get a single contract with all key terms

**Auth Required:** Yes

**Response (200):**
```json
{
  "contract": {
    "id": "uuid",
    "name": "string",
    "type": "nda" | "msa",
    "status": "completed",
    "contract_text": "string (full text)",
    "file_path": "string | null",
    "file_url": "string | null (signed URL, 1 hour expiry)",
    "page_count": 12,
    "created_at": "ISO timestamp"
  },
  "terms": [
    {
      "id": "uuid",
      "term_name": "string",
      "value": "string | null",
      "page_number": "integer | null",
      "confidence_score": 0.85,
      "source_sentence": "string | null",
      "is_manual": false,
      "is_edited": false
    }
  ]
}
```

**Error Responses:**
- 404: Contract not found
- 403: Contract belongs to another user

---

#### PATCH /api/contracts/[id]/terms/[termId]

**Purpose:** Edit an extracted key term

**Auth Required:** Yes

**Request Body:**
```json
{
  "value": "string"
}
```

**Response (200):**
```json
{
  "term": {
    "id": "uuid",
    "term_name": "string",
    "value": "string (new value)",
    "is_edited": true,
    "original_value": "string (AI value)"
  }
}
```

**Error Responses:**
- 404: Term not found
- 403: Contract belongs to another user

---

#### POST /api/contracts/[id]/chat

**Purpose:** Send a chat message and get AI response

**Auth Required:** Yes

**Request Body:**
```json
{
  "message": "string"
}
```

**Response (200):**
```json
{
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Based on the document, the NDA terminates after 24 months from the Effective Date. [Page 3]",
    "page_citation": 3,
    "created_at": "ISO timestamp"
  }
}
```

**Error Responses:**
- 404: Contract not found
- 403: Contract belongs to another user
- 500: OpenAI API error

---

#### GET /api/contracts/[id]/chat

**Purpose:** Get chat history for a contract

**Auth Required:** Yes

**Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "created_at": "ISO timestamp"
  },
  "messages": [
    {
      "id": "uuid",
      "role": "user" | "assistant",
      "content": "string",
      "page_citation": "integer | null",
      "created_at": "ISO timestamp"
    }
  ]
}
```

---

#### POST /api/feedback

**Purpose:** Submit feedback on a contract analysis

**Auth Required:** Yes

**Request Body:**
```json
{
  "contract_id": "uuid",
  "rating": -1 | 1,
  "comment": "string (optional)"
}
```

**Response (201):**
```json
{
  "feedback": {
    "id": "uuid",
    "created_at": "ISO timestamp"
  }
}
```

**Error Responses:**
- 404: Contract not found
- 403: Contract belongs to another user
- 400: Invalid rating value

---

#### DELETE /api/contracts/[id]

**Purpose:** Delete a contract and all associated data

**Auth Required:** Yes

**Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- 404: Contract not found
- 403: Contract belongs to another user

---

## 10. Feature Breakdown

### Phase 1: MVP Foundation (v0.1 - v0.2)

#### F1.1: User Authentication

**Description:** Email/password sign up, sign in, and sign out via Supabase Auth.

**Acceptance Criteria:**
- User can create account with email and password (min 8 chars)
- User can sign in with valid credentials
- Invalid credentials show clear error message
- User can sign out and session is cleared
- Auth state persists across page refreshes

**Dependencies:** Supabase project setup

---

#### F1.2: PDF Upload and Text Extraction

**Description:** Upload a PDF contract and extract text with page markers.

**Acceptance Criteria:**
- Drag-and-drop or file picker upload
- File validated: PDF only, ≤ 10 MB, ≤ 20 pages
- Text extracted with [PAGE N] markers
- Scanned PDFs rejected with clear error (< 100 words extracted)
- Contract stored in database with status "pending"
- PDF optionally stored in Supabase Storage

**Dependencies:** F1.1 (auth)

---

#### F1.3: Key Term Extraction

**Description:** AI-powered extraction of key terms using GPT-4o.

**Acceptance Criteria:**
- Standard terms extracted based on contract type (NDA: 10, MSA: 12)
- Each term includes: name, value, page number, confidence score, source sentence
- Extraction completes within 30 seconds P95
- Results stored in key_terms table
- Contract status updated to "completed"

**Dependencies:** F1.2 (upload)

---

#### F1.4: Key Terms Panel

**Description:** Display extracted terms with confidence scores.

**Acceptance Criteria:**
- Two-panel layout: PDF viewer left, key terms right
- Each term shows: name, value, page number, confidence badge
- Confidence colour-coded: green ≥80%, amber 50-79%, red <50%
- Low confidence terms show ⚠️ warning
- Expandable "Why?" section shows source sentence

**Dependencies:** F1.3 (extraction)

---

### Phase 2: Enriched Experience (v0.3 - v0.4)

#### F2.1: PDF Viewer

**Description:** Interactive PDF viewer with navigation.

**Acceptance Criteria:**
- PDF renders inline using PDF.js
- Scroll and zoom controls
- Page numbers displayed
- Click page reference in key terms → scrolls to page
- Text viewer fallback if Storage unavailable

**Dependencies:** F1.4 (key terms panel)

---

#### F2.2: Custom Term Addition

**Description:** User can add up to 5 custom terms before processing.

**Acceptance Criteria:**
- "+ Add Key Term" button on upload screen
- Custom terms shown in preview with "Custom" badge
- Custom terms included in AI extraction
- Custom terms stored in key_terms with is_manual = true

**Dependencies:** F1.2 (upload)

---

#### F2.3: Contract Chat

**Description:** Chat with the contract using natural language.

**Acceptance Criteria:**
- Chat interface accessible from results page
- Responses grounded in document text only
- Each response includes [Page X] citation
- "I cannot find this in the document" for absent info
- Response latency ≤ 15 seconds P95

**Dependencies:** F1.3 (extraction)

---

#### F2.4: Chat History

**Description:** Persistent chat history per contract.

**Acceptance Criteria:**
- Chat messages saved to database in real-time
- Previous messages loaded when revisiting contract
- Full conversation history passed to AI for context
- Session persists across page refreshes

**Dependencies:** F2.3 (chat)

---

#### F2.5: Dashboard with Contract History

**Description:** Dashboard showing all reviewed contracts.

**Acceptance Criteria:**
- Summary card: total contracts, breakdown by type
- Sortable list: name, type, date, status
- Click row → opens results page
- Empty state with CTA for new users
- Quick action button: "Review a Contract"

**Dependencies:** F1.3 (extraction)

---

#### F2.6: Inline Term Editing

**Description:** User can edit extracted term values.

**Acceptance Criteria:**
- Click edit icon on any term
- Inline input with save/cancel
- Original AI value preserved in original_value column
- "Edited" badge shown on modified terms
- Save completes within 2 seconds

**Dependencies:** F1.4 (key terms panel)

---

### Phase 3: Launch (v1.0)

#### F3.1: Feedback Collection

**Description:** Thumbs up/down rating with optional comment.

**Acceptance Criteria:**
- Feedback form on results page
- Thumbs up (1) / thumbs down (-1) selection
- Optional text comment field
- Submit stores feedback in database
- "Thank you" confirmation shown

**Dependencies:** F1.3 (extraction)

---

#### F3.2: Performance Optimization

**Description:** Meet latency targets across all operations.

**Acceptance Criteria:**
- Upload + extraction ≤ 30 seconds P95
- Chat response ≤ 15 seconds P95
- Page load ≤ 2 seconds P95
- Lazy loading for PDF pages
- Skeleton loaders for async operations

**Dependencies:** All Phase 1-2 features

---

#### F3.3: Security Audit

**Description:** Security review and hardening.

**Acceptance Criteria:**
- RLS policies verified via cross-user access tests
- Signed URLs expire after 1 hour
- API keys stored in environment variables only
- Rate limiting on AI endpoints (10 req/min/user)
- Input sanitization on all user inputs

**Dependencies:** All Phase 1-2 features

---

#### F3.4: Onboarding

**Description:** First-time user guidance.

**Acceptance Criteria:**
- Onboarding tooltips for key features
- "Not legal advice" disclaimer on every results page
- Empty state guidance on dashboard
- Help link in header

**Dependencies:** F2.5 (dashboard)

---

## 11. Folder Structure

```
src/
├── app/                                    # Next.js App Router
│   ├── (marketing)/                        # Public marketing pages
│   │   ├── page.tsx                        # Landing page
│   │   └── layout.tsx                      # Marketing layout
│   ├── (auth)/                             # Auth pages (centered card layout)
│   │   ├── login/
│   │   │   └── page.tsx                    # Sign in page
│   │   ├── signup/
│   │   │   └── page.tsx                    # Sign up page
│   │   └── layout.tsx                      # Auth layout
│   ├── (dashboard)/                        # Protected app pages
│   │   ├── layout.tsx                      # Dashboard layout (sidebar/header)
│   │   ├── page.tsx                        # Dashboard home (contract list)
│   │   ├── upload/
│   │   │   └── page.tsx                    # Upload wizard
│   │   └── contracts/
│   │       └── [id]/
│   │           ├── page.tsx                # Results page
│   │           └── loading.tsx             # Skeleton loader
│   ├── api/                                # API Route Handlers
│   │   ├── auth/
│   │   │   ├── signup/route.ts             # POST /api/auth/signup
│   │   │   ├── login/route.ts              # POST /api/auth/login
│   │   │   └── logout/route.ts             # POST /api/auth/logout
│   │   ├── contracts/
│   │   │   ├── route.ts                    # GET /api/contracts
│   │   │   ├── upload/route.ts             # POST /api/contracts/upload
│   │   │   └── [id]/
│   │   │       ├── route.ts                # GET, DELETE /api/contracts/[id]
│   │   │       ├── process/route.ts        # POST /api/contracts/[id]/process
│   │   │       ├── chat/route.ts           # GET, POST /api/contracts/[id]/chat
│   │   │       └── terms/
│   │   │           └── [termId]/route.ts   # PATCH /api/contracts/[id]/terms/[termId]
│   │   └── feedback/
│   │       └── route.ts                    # POST /api/feedback
│   ├── layout.tsx                          # Root layout
│   └── globals.css                         # Global styles
│
├── components/                             # React components
│   ├── ui/                                 # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── badge.tsx
│   │   ├── tooltip.tsx
│   │   ├── progress.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx
│   │   └── toaster.tsx
│   ├── layout/
│   │   ├── header.tsx                      # App header
│   │   ├── sidebar.tsx                     # Dashboard sidebar
│   │   └── footer.tsx                      # Marketing footer
│   ├── auth/
│   │   ├── auth-form.tsx                   # Login/signup form
│   │   └── user-menu.tsx                   # User dropdown
│   ├── contracts/
│   │   ├── contract-list.tsx               # Dashboard contract table
│   │   ├── contract-card.tsx               # Contract summary card
│   │   ├── upload-dropzone.tsx             # Drag-and-drop upload
│   │   ├── contract-type-selector.tsx      # NDA/MSA dropdown
│   │   ├── custom-term-input.tsx           # Add custom term
│   │   ├── processing-progress.tsx         # 3-step progress
│   │   ├── pdf-viewer.tsx                  # PDF.js wrapper
│   │   ├── text-viewer.tsx                 # Text fallback viewer
│   │   ├── key-terms-panel.tsx             # Terms list container
│   │   ├── key-term-row.tsx                # Single term row
│   │   ├── confidence-badge.tsx            # Colour-coded badge
│   │   └── source-sentence.tsx             # Expandable source
│   ├── chat/
│   │   ├── chat-interface.tsx              # Chat container
│   │   ├── chat-message.tsx                # Message bubble
│   │   ├── chat-input.tsx                  # Input with send
│   │   └── page-citation.tsx               # Clickable citation
│   ├── feedback/
│   │   └── feedback-form.tsx               # Rating + comment
│   └── shared/
│       ├── loading-spinner.tsx
│       ├── empty-state.tsx
│       ├── error-boundary.tsx
│       └── disclaimer.tsx                  # "Not legal advice" banner
│
├── lib/                                    # Utilities and services
│   ├── supabase/
│   │   ├── client.ts                       # Browser client
│   │   ├── server.ts                       # Server client (API routes)
│   │   └── middleware.ts                   # Auth middleware
│   ├── openai/
│   │   ├── client.ts                       # OpenAI client
│   │   ├── prompts/
│   │   │   ├── extraction.ts               # Extraction prompt builder
│   │   │   └── chat.ts                     # Chat prompt builder
│   │   └── parse-response.ts               # JSON response parser
│   ├── pdf/
│   │   └── extract-text.ts                 # pdf-parse wrapper
│   ├── contracts/
│   │   ├── upload.ts                       # Upload service
│   │   ├── process.ts                      # Processing service
│   │   └── terms.ts                        # Terms CRUD
│   └── validation/
│       └── schemas.ts                      # Zod schemas
│
├── hooks/                                  # Custom React hooks
│   ├── use-auth.ts                         # Auth state hook
│   ├── use-contracts.ts                    # Contracts query hook
│   ├── use-contract.ts                     # Single contract query
│   ├── use-chat.ts                         # Chat operations hook
│   └── use-upload.ts                       # Upload mutation hook
│
├── types/                                  # TypeScript types
│   ├── contract.ts                         # Contract types
│   ├── key-term.ts                         # KeyTerm types
│   ├── chat.ts                             # Chat types
│   ├── feedback.ts                         # Feedback types
│   └── api.ts                              # API request/response types
│
├── styles/                                 # Additional styles
│   └── pdf-viewer.css                      # PDF.js custom styles
│
├── constants/                              # App constants
│   ├── terms.ts                            # Standard NDA/MSA terms
│   └── limits.ts                           # File size, page limits
│
├── middleware.ts                           # Next.js middleware (auth redirect)
│
├── docs/                                   # Documentation
│   ├── engineering/
│   │   └── engineering-doc.md              # This document
│   └── specs/                              # Implementation specs (Stage 2)
│
├── supabase/                               # Supabase config
│   └── migrations/                         # SQL migrations
│
├── public/                                 # Static assets
│   ├── logo.svg
│   └── og-image.png
│
├── .env.example                            # Environment variables template
├── .env.local                              # Local environment (gitignored)
├── next.config.js                          # Next.js config
├── tailwind.config.ts                      # Tailwind config
├── tsconfig.json                           # TypeScript config
├── package.json
└── README.md
```

---

## 12. Naming Conventions

### Files and Folders

| Type | Convention | Example |
|------|------------|---------|
| Pages | kebab-case | `upload/page.tsx`, `contracts/[id]/page.tsx` |
| Components | kebab-case files, PascalCase exports | `key-term-row.tsx` → `KeyTermRow` |
| Hooks | camelCase with `use` prefix | `use-contract.ts` → `useContract` |
| Lib/Services | kebab-case | `extract-text.ts`, `parse-response.ts` |
| Types | kebab-case | `key-term.ts` |
| API Routes | kebab-case | `/api/contracts/upload/route.ts` |
| Test files | `*.test.ts` or `*.spec.ts` | `extract-text.test.ts` |

### Code

| Type | Convention | Example |
|------|------------|---------|
| React Components | PascalCase | `ContractList`, `KeyTermRow` |
| React Hooks | camelCase with `use` prefix | `useAuth`, `useContract` |
| Functions | camelCase | `extractText`, `parseResponse` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE`, `STANDARD_NDA_TERMS` |
| TypeScript Types/Interfaces | PascalCase | `Contract`, `KeyTerm`, `ChatMessage` |
| Enums | PascalCase | `ContractType`, `ContractStatus` |

### Database

| Type | Convention | Example |
|------|------------|---------|
| Tables | snake_case (plural) | `contracts`, `key_terms`, `chat_messages` |
| Columns | snake_case | `user_id`, `contract_text`, `confidence_score` |
| Foreign Keys | `<singular_table>_id` | `contract_id`, `session_id` |
| Indexes | `idx_<table>_<column>` | `idx_contracts_user_id` |
| Policies | Descriptive sentence | `"Users can only access their own contracts"` |

### Environment Variables

| Convention | Example |
|------------|---------|
| SCREAMING_SNAKE_CASE | `NEXT_PUBLIC_SUPABASE_URL` |
| Prefix `NEXT_PUBLIC_` for client-exposed | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| No prefix for server-only | `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` |

### API

| Type | Convention | Example |
|------|------------|---------|
| Endpoints | kebab-case | `/api/contracts/upload` |
| Path parameters | `[id]` | `/api/contracts/[id]` |
| Query parameters | camelCase | `?sortOrder=desc&pageSize=20` |
| Request/Response body | camelCase | `{ contractId, termName }` |

---

## 13. Testing Strategy

### Overview

| Test Type | Framework | Target Coverage |
|-----------|-----------|-----------------|
| Unit | Vitest | 80% |
| Integration | Vitest + Supabase Test DB | 70% |
| E2E | Playwright | Critical paths |

### Unit Tests

**Scope:** Pure functions, utilities, prompt builders, response parsers

**Location:** `__tests__/unit/` or colocated `*.test.ts`

**Examples:**
- `lib/pdf/extract-text.test.ts` — Text extraction with page markers
- `lib/openai/parse-response.test.ts` — JSON parsing and validation
- `lib/openai/prompts/extraction.test.ts` — Prompt construction
- `lib/validation/schemas.test.ts` — Zod schema validation

**Coverage Target:** 80% line coverage

### Integration Tests

**Scope:** API routes, database operations, service interactions

**Location:** `__tests__/integration/`

**Setup:**
- Supabase local instance or test project
- Seeded test data
- Mocked OpenAI responses (deterministic)

**Examples:**
- `api/contracts/upload.test.ts` — Upload flow end-to-end
- `api/contracts/[id]/process.test.ts` — Extraction with mocked OpenAI
- `api/contracts/[id]/chat.test.ts` — Chat with mocked OpenAI
- `lib/contracts/terms.test.ts` — CRUD operations on key_terms

**Coverage Target:** 70% line coverage

### E2E Tests

**Scope:** Critical user flows in browser

**Location:** `e2e/`

**Framework:** Playwright

**Flows to Test:**
1. Sign up → Dashboard → Empty state
2. Sign in → Dashboard → Contract list
3. Upload contract → Processing → Results page
4. Results page → Edit term → Verify save
5. Results page → Chat → Verify response
6. Results page → Submit feedback

**Example:**
```typescript
// e2e/contract-review.spec.ts
test('user can upload and review a contract', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'testpassword');
  await page.click('button[type="submit"]');

  await page.waitForURL('/dashboard');
  await page.click('text=Review a Contract');

  await page.setInputFiles('input[type="file"]', 'fixtures/sample-nda.pdf');
  await page.selectOption('[name="type"]', 'nda');
  await page.click('text=Process Contract');

  await page.waitForURL(/\/contracts\/[\w-]+/);
  await expect(page.locator('[data-testid="key-terms-panel"]')).toBeVisible();
  await expect(page.locator('text=Governing Law')).toBeVisible();
});
```

### Test Data

**Fixtures:**
- `fixtures/sample-nda.pdf` — 5-page NDA with all standard terms
- `fixtures/sample-msa.pdf` — 10-page MSA with all standard terms
- `fixtures/scanned-pdf.pdf` — Image-based PDF (should fail)
- `fixtures/large-pdf.pdf` — 25-page PDF (should be rejected)

**Mocked OpenAI Responses:**
- `fixtures/openai/extraction-nda.json` — Expected extraction response
- `fixtures/openai/extraction-msa.json` — Expected extraction response
- `fixtures/openai/chat-response.json` — Sample chat response

### CI/CD Integration

- Unit and integration tests run on every PR
- E2E tests run on merge to main
- Coverage report generated and tracked
- Fail build if coverage drops below thresholds

---

## 14. Specs to Implementation Mapping

### US-001: User Authentication

| Spec | Implementation |
|------|----------------|
| Sign up | `app/(auth)/signup/page.tsx`, `app/api/auth/signup/route.ts` |
| Sign in | `app/(auth)/login/page.tsx`, `app/api/auth/login/route.ts` |
| Sign out | `components/auth/user-menu.tsx`, `app/api/auth/logout/route.ts` |
| Auth state | `hooks/use-auth.ts`, `lib/supabase/client.ts` |
| Auth redirect | `middleware.ts` |
| Database | `auth.users` (Supabase managed) |
| Tests | `__tests__/integration/api/auth.test.ts`, `e2e/auth.spec.ts` |

### US-002: PDF Upload + Text Extraction

| Spec | Implementation |
|------|----------------|
| Upload UI | `app/(dashboard)/upload/page.tsx`, `components/contracts/upload-dropzone.tsx` |
| Type selector | `components/contracts/contract-type-selector.tsx` |
| Upload API | `app/api/contracts/upload/route.ts` |
| Text extraction | `lib/pdf/extract-text.ts` |
| Storage upload | `lib/contracts/upload.ts` |
| Database | `contracts` table |
| Validation | `lib/validation/schemas.ts` |
| Tests | `__tests__/unit/lib/pdf/extract-text.test.ts`, `__tests__/integration/api/contracts/upload.test.ts` |

### US-003 + US-004: Key Term Extraction with Confidence

| Spec | Implementation |
|------|----------------|
| Process API | `app/api/contracts/[id]/process/route.ts` |
| OpenAI call | `lib/openai/client.ts`, `lib/openai/prompts/extraction.ts` |
| Response parsing | `lib/openai/parse-response.ts` |
| Processing service | `lib/contracts/process.ts` |
| Database | `key_terms` table |
| Standard terms | `constants/terms.ts` |
| Tests | `__tests__/unit/lib/openai/prompts/extraction.test.ts`, `__tests__/integration/api/contracts/process.test.ts` |

### US-005: Custom Term Addition

| Spec | Implementation |
|------|----------------|
| Custom term UI | `components/contracts/custom-term-input.tsx` |
| Upload with terms | `app/api/contracts/upload/route.ts` (accepts customTerms) |
| Prompt injection | `lib/openai/prompts/extraction.ts` |
| Database | `custom_key_terms` table, `key_terms.is_manual` |
| Tests | `__tests__/integration/api/contracts/upload.test.ts` |

### US-006: PDF Viewer

| Spec | Implementation |
|------|----------------|
| PDF viewer | `components/contracts/pdf-viewer.tsx` |
| Text fallback | `components/contracts/text-viewer.tsx` |
| Page navigation | `components/contracts/key-term-row.tsx` (click handler) |
| Signed URL | `app/api/contracts/[id]/route.ts` (generates signed URL) |
| Tests | `e2e/contract-results.spec.ts` |

### US-007 + US-012: Contract Chat with History

| Spec | Implementation |
|------|----------------|
| Chat UI | `components/chat/chat-interface.tsx`, `components/chat/chat-message.tsx`, `components/chat/chat-input.tsx` |
| Chat API (send) | `app/api/contracts/[id]/chat/route.ts` (POST) |
| Chat API (history) | `app/api/contracts/[id]/chat/route.ts` (GET) |
| Chat prompt | `lib/openai/prompts/chat.ts` |
| Page citation | `components/chat/page-citation.tsx` |
| Database | `chat_sessions`, `chat_messages` tables |
| Hook | `hooks/use-chat.ts` |
| Tests | `__tests__/integration/api/contracts/chat.test.ts`, `e2e/chat.spec.ts` |

### US-008: Dashboard with History

| Spec | Implementation |
|------|----------------|
| Dashboard page | `app/(dashboard)/page.tsx` |
| Contract list | `components/contracts/contract-list.tsx`, `components/contracts/contract-card.tsx` |
| Empty state | `components/shared/empty-state.tsx` |
| List API | `app/api/contracts/route.ts` |
| Hook | `hooks/use-contracts.ts` |
| Tests | `__tests__/integration/api/contracts/list.test.ts`, `e2e/dashboard.spec.ts` |

### US-009: Inline Term Editing

| Spec | Implementation |
|------|----------------|
| Edit UI | `components/contracts/key-term-row.tsx` |
| Edit API | `app/api/contracts/[id]/terms/[termId]/route.ts` |
| Service | `lib/contracts/terms.ts` |
| Database | `key_terms.value`, `key_terms.is_edited`, `key_terms.original_value` |
| Tests | `__tests__/integration/api/contracts/terms.test.ts` |

### US-010: Feedback Submission

| Spec | Implementation |
|------|----------------|
| Feedback UI | `components/feedback/feedback-form.tsx` |
| Feedback API | `app/api/feedback/route.ts` |
| Database | `user_feedback` table |
| Tests | `__tests__/integration/api/feedback.test.ts` |

---

## Appendix: Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend Framework | Next.js 14 (App Router) | Server components, API routes, streaming, strong ecosystem |
| UI Library | shadcn/ui | Accessible, customizable, Tailwind-native |
| State Management | TanStack Query + Context | Server state caching, minimal boilerplate |
| Auth Provider | Supabase Auth | Integrated with DB, RLS-ready, email/password built-in |
| Database | Supabase PostgreSQL | Managed Postgres, RLS, real-time, storage in one platform |
| LLM Provider | OpenAI (GPT-4o) | Best accuracy on legal text, JSON mode, 128k context |
| PDF Parsing | pdf-parse | Server-side, no external service, handles text-layer PDFs |
| PDF Rendering | PDF.js | Client-side, no server load, mature library |
| Hosting | Netlify (frontend) + Supabase | Zero-config, scales automatically, cost-effective |
| Testing | Vitest + Playwright | Fast unit tests, reliable E2E, good DX |

---

*This document is the authoritative reference for ContractIQ engineering. No implementation begins until this document is approved.*
