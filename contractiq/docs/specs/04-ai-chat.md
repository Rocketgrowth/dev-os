# Contract Chat Specification

## Overview

Users can chat with their contracts using natural language. The AI provides answers grounded in the document text with mandatory page citations. Chat history is persisted per contract.

---

## User Flow

```
1. User on Results Page (/contracts/[id])
2. User clicks "Chat" tab or floating chat button
3. Chat interface opens (right panel or slide-out)
4. If existing session: load previous messages
5. If new session: create new chat_session record
6. User types question (e.g., "What happens if I breach the NDA?")
7. User message appears immediately in UI (optimistic)
8. Frontend calls POST /api/contracts/[id]/chat
9. Backend:
   - Fetches contract_text from database
   - Fetches conversation history (up to 200 messages)
   - Builds chat prompt with system instructions
   - Calls OpenAI GPT-4o
   - Parses response and extracts page citation
   - Stores user message and assistant response in database
10. Assistant response appears with clickable page citation
11. User clicks [Page X] citation → PDF viewer scrolls to page
```

---

## API Routes

### POST /api/contracts/[id]/chat

**File:** `app/api/contracts/[id]/chat/route.ts`

**Request Body:**
```json
{
  "message": "string"
}
```

**Success Response (200):**
```json
{
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Based on the document, the NDA terminates after 24 months from the Effective Date. [Page 3]",
    "page_citation": 3,
    "created_at": "2024-01-15T10:35:00Z"
  }
}
```

**Error Responses:**

| Status | Error | Condition |
|--------|-------|-----------|
| 400 | "Message is required." | Empty message |
| 400 | "Message too long. Maximum 1000 characters." | Message > 1000 chars |
| 401 | "Unauthorized" | No valid session |
| 403 | "Forbidden" | Contract belongs to another user |
| 404 | "Contract not found." | Invalid contract ID |
| 500 | "Failed to get response. Please try again." | OpenAI API error |

**Implementation:**
```typescript
import { createClient } from '@/lib/supabase/server'
import { callChatAPI } from '@/lib/openai/client'
import { buildChatPrompt } from '@/lib/openai/prompts/chat'
import { parseChatResponse } from '@/lib/openai/parse-response'

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

  const { message } = await request.json()

  // Validate message
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return Response.json({ error: 'Message is required.' }, { status: 400 })
  }

  if (message.length > 1000) {
    return Response.json(
      { error: 'Message too long. Maximum 1000 characters.' },
      { status: 400 }
    )
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

  // Get or create chat session
  let { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('contract_id', params.id)
    .single()

  if (!session) {
    const { data: newSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .insert({ contract_id: params.id })
      .select()
      .single()

    if (sessionError) throw sessionError
    session = newSession
  }

  // Fetch conversation history
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })
    .limit(200)

  // Store user message
  await supabase.from('chat_messages').insert({
    session_id: session.id,
    role: 'user',
    content: message,
  })

  try {
    // Build prompt
    const prompt = buildChatPrompt({
      contractText: contract.contract_text!,
      conversationHistory: history || [],
      userMessage: message,
    })

    // Call OpenAI
    const response = await callChatAPI(prompt)

    // Parse response and extract page citation
    const { content, pageCitation } = parseChatResponse(response)

    // Store assistant message
    const { data: assistantMessage } = await supabase
      .from('chat_messages')
      .insert({
        session_id: session.id,
        role: 'assistant',
        content,
        page_citation: pageCitation,
      })
      .select()
      .single()

    return Response.json({ message: assistantMessage })
  } catch (error) {
    return Response.json(
      { error: 'Failed to get response. Please try again.' },
      { status: 500 }
    )
  }
}
```

### GET /api/contracts/[id]/chat

**File:** `app/api/contracts/[id]/chat/route.ts`

**Success Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "What is the NDA duration?",
      "page_citation": null,
      "created_at": "2024-01-15T10:32:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "Based on the document, the NDA has a duration of 24 months from the Effective Date. [Page 3]",
      "page_citation": 3,
      "created_at": "2024-01-15T10:32:05Z"
    }
  ]
}
```

**Implementation:**
```typescript
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch contract to verify ownership
  const { data: contract } = await supabase
    .from('contracts')
    .select('user_id')
    .eq('id', params.id)
    .single()

  if (!contract || contract.user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch chat session
  const { data: session } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('contract_id', params.id)
    .single()

  if (!session) {
    return Response.json({ session: null, messages: [] })
  }

  // Fetch messages
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })

  return Response.json({ session, messages: messages || [] })
}
```

---

## OpenAI Integration

### Chat API Call

**File:** `lib/openai/client.ts`

```typescript
export async function callChatAPI(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o'
  const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS_CHAT || '1000')
  const temperature = parseFloat(process.env.OPENAI_TEMPERATURE_CHAT || '0.4')

  const response = await openai.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  })

  return response.choices[0].message.content || ''
}
```

### Chat Prompt Builder

**File:** `lib/openai/prompts/chat.ts`

```typescript
interface ChatPromptParams {
  contractText: string
  conversationHistory: { role: string; content: string }[]
  userMessage: string
}

export function buildChatPrompt(params: ChatPromptParams) {
  const { contractText, conversationHistory, userMessage } = params

  const systemPrompt = `You are a contract analysis assistant. Answer questions using ONLY the contract text provided below. Do not use any external knowledge.

Rules:
1. If the answer is in the document, provide it with a [Page X] citation
2. If the answer is NOT in the document, respond: "I cannot find this information in the document."
3. Always prefix your answer with "Based on the document..."
4. Be concise and direct
5. Look for [PAGE N] markers in the text to determine page numbers
6. Always include a page citation in brackets at the end of your response, like [Page 3]

Contract Text:
${contractText}`

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ]

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage })

  return messages
}
```

### Chat Response Parser

**File:** `lib/openai/parse-response.ts`

```typescript
interface ParsedChatResponse {
  content: string
  pageCitation: number | null
}

export function parseChatResponse(response: string): ParsedChatResponse {
  // Extract page citation from response (e.g., "[Page 3]" or "[Page 12]")
  const pageMatch = response.match(/\[Page\s+(\d+)\]/i)
  const pageCitation = pageMatch ? parseInt(pageMatch[1], 10) : null

  return {
    content: response,
    pageCitation,
  }
}
```

---

## Frontend Components

### ChatInterface Component

**File:** `components/chat/chat-interface.tsx`

**Features:**
- Chat message list with auto-scroll
- Input field with send button
- Loading state while waiting for response
- Error message display
- Clickable page citations

**Implementation:**
```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@/hooks/use-chat'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ChatInterfaceProps {
  contractId: string
  onPageClick: (page: number) => void
}

export function ChatInterface({ contractId, onPageClick }: ChatInterfaceProps) {
  const { messages, sendMessage, isLoading, error } = useChat(contractId)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h3 className="font-semibold">Chat with Contract</h3>
        <p className="text-sm text-muted-foreground">
          Ask questions about your contract
        </p>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Start by asking a question about your contract
            </p>
          )}
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onPageClick={onPageClick}
            />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="animate-pulse">Thinking...</div>
            </div>
          )}
        </div>
      </ScrollArea>

      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  )
}
```

### ChatMessage Component

**File:** `components/chat/chat-message.tsx`

**Props:**
```typescript
interface ChatMessageProps {
  message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    page_citation: number | null
  }
  onPageClick: (page: number) => void
}
```

**Features:**
- Different styling for user vs assistant messages
- Clickable page citations
- Formatted content with proper spacing

### ChatInput Component

**File:** `components/chat/chat-input.tsx`

**Props:**
```typescript
interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}
```

**Features:**
- Text input with character limit display
- Send button (disabled when empty or loading)
- Enter key to send

### PageCitation Component

**File:** `components/chat/page-citation.tsx`

**Props:**
```typescript
interface PageCitationProps {
  page: number
  onClick: () => void
}
```

**Features:**
- Styled as inline link
- Hover state
- Click triggers PDF navigation

---

## Hooks

### useChat Hook

**File:** `hooks/use-chat.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  page_citation: number | null
  created_at: string
}

export function useChat(contractId: string) {
  const queryClient = useQueryClient()

  const { data, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['chat', contractId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/chat`)
      if (!res.ok) throw new Error('Failed to load chat')
      return res.json()
    },
  })

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/contracts/${contractId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error)
      }
      return res.json()
    },
    onMutate: async (message) => {
      // Optimistic update for user message
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        page_citation: null,
        created_at: new Date().toISOString(),
      }
      queryClient.setQueryData(['chat', contractId], (old: any) => ({
        ...old,
        messages: [...(old?.messages || []), optimisticMessage],
      }))
    },
    onSuccess: (data) => {
      // Add assistant message
      queryClient.setQueryData(['chat', contractId], (old: any) => ({
        ...old,
        messages: [...(old?.messages || []), data.message],
      }))
    },
    onError: () => {
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: ['chat', contractId] })
    },
  })

  return {
    messages: data?.messages || [],
    session: data?.session,
    isLoading: sendMutation.isPending,
    isLoadingHistory,
    error: sendMutation.error?.message || null,
    sendMessage: sendMutation.mutate,
  }
}
```

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| Chat response latency (P95) | ≤ 15 seconds |
| Cost per chat turn | ≤ $0.05 |
| Max conversation history | 200 messages |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Empty message | Reject with validation error |
| Message > 1000 chars | Reject with validation error |
| Question about absent info | AI responds "I cannot find this information in the document." |
| OpenAI API error | Display error, allow retry |
| No chat session exists | Create new session automatically |
| Page citation not parseable | Set page_citation to null |
| Previous messages exceed context | Truncate oldest messages |

---

## Acceptance Criteria

- [ ] Chat interface accessible from results page
- [ ] User messages appear immediately (optimistic UI)
- [ ] Responses grounded in document text only
- [ ] Each response includes [Page X] citation
- [ ] "I cannot find this in the document" for absent info
- [ ] Response latency ≤ 15 seconds P95
- [ ] Chat messages saved to database in real-time
- [ ] Previous messages loaded when revisiting contract
- [ ] Clickable page citations navigate to PDF page
