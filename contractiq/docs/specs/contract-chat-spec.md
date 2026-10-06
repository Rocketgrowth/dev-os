# Contract Chat Specification

## Overview

Users can chat with their contracts using natural language. The AI answers questions grounded in the document text with mandatory page citations.

---

## User Flow

```
1. User on Results Page (/contracts/[id])
2. User clicks "Chat" tab or button
3. Chat interface opens (right panel or slide-out)
4. User types question (e.g., "What happens if I breach the NDA?")
5. Frontend appends user message to UI
6. POST /api/contracts/[id]/chat with message
7. Backend fetches contract text and chat history
8. Backend calls OpenAI GPT-4o with context
9. Backend extracts [Page X] citation from response
10. Backend stores both messages in database
11. Frontend renders assistant response with clickable citation
12. User clicks page citation
13. PDF viewer scrolls to cited page
```

---

## OpenAI Configuration

| Setting | Value |
|---------|-------|
| Model | `gpt-4o` |
| Temperature | `0.4` (natural but focused) |
| Max Output Tokens | `1,000` |
| Timeout | `15 seconds` |
| Retries | `3` with exponential backoff |

---

## Prompt Template

```typescript
const CHAT_SYSTEM_PROMPT = `You are a contract analysis assistant. Answer questions using ONLY the contract text provided below. Do not use any external knowledge.

Rules:
1. If the answer is in the document, provide it with a [Page X] citation
2. If the answer is NOT in the document, respond: "I cannot find this information in the document."
3. Always prefix your answer with "Based on the document..."
4. Be concise and direct
5. Quote relevant text when helpful
6. Never make assumptions or infer information not explicitly stated

Remember: You can ONLY answer based on the contract text. If something isn't in the document, say so.`

const buildChatPrompt = (
  contractText: string,
  conversationHistory: Message[],
  newQuestion: string
) => {
  const messages = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    { role: 'user', content: `Contract Text:\n\n${contractText}` },
    ...conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user', content: newQuestion },
  ]
  return messages
}
```

---

## Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/api/contracts/[id]/chat/route.ts` | Chat API endpoint (GET + POST) |
| `src/lib/openai/prompts/chat.ts` | Chat prompt builder |
| `src/components/chat/chat-interface.tsx` | Chat container component |
| `src/components/chat/chat-message.tsx` | Single message bubble |
| `src/components/chat/chat-input.tsx` | Message input with send |
| `src/components/chat/page-citation.tsx` | Clickable page link |
| `src/hooks/use-chat.ts` | Chat operations hook |

---

### `src/lib/openai/prompts/chat.ts`

```typescript
interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `You are a contract analysis assistant. Answer questions using ONLY the contract text provided below. Do not use any external knowledge.

Rules:
1. If the answer is in the document, provide it with a [Page X] citation
2. If the answer is NOT in the document, respond: "I cannot find this information in the document."
3. Always prefix your answer with "Based on the document..."
4. Be concise and direct
5. Quote relevant text when helpful
6. Never make assumptions or infer information not explicitly stated

Remember: You can ONLY answer based on the contract text. If something isn't in the document, say so.`

export function buildChatMessages(
  contractText: string,
  conversationHistory: Message[],
  newQuestion: string
): Array<{ role: string; content: string }> {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Contract Text:\n\n${contractText}` },
    ...conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user', content: newQuestion },
  ]
}

export function extractPageCitation(response: string): number | null {
  const match = response.match(/\[Page\s*(\d+)\]/i)
  return match ? parseInt(match[1], 10) : null
}
```

---

### `src/app/api/contracts/[id]/chat/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { buildChatMessages, extractPageCitation } from '@/lib/openai/prompts/chat'
import { z } from 'zod'

const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
})

// GET - Fetch chat history
export async function GET(
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

    // Verify contract ownership
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, user_id')
      .eq('id', contractId)
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    if (contract.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get or create chat session
    let { data: session } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('contract_id', contractId)
      .single()

    if (!session) {
      const { data: newSession } = await supabase
        .from('chat_sessions')
        .insert({ contract_id: contractId })
        .select()
        .single()
      session = newSession
    }

    // Fetch messages
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      session: {
        id: session.id,
        created_at: session.created_at,
      },
      messages: messages || [],
    })

  } catch (error) {
    console.error('Chat fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Send message and get AI response
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

    // Parse request
    const body = await request.json()
    const { message } = chatRequestSchema.parse(body)

    // Fetch contract with text
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    if (contract.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get or create chat session
    let { data: session } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('contract_id', contractId)
      .single()

    if (!session) {
      const { data: newSession } = await supabase
        .from('chat_sessions')
        .insert({ contract_id: contractId })
        .select()
        .single()
      session = newSession
    }

    // Fetch conversation history (up to 200 messages)
    const { data: historyMessages } = await supabase
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

    // Build prompt and call OpenAI
    const chatMessages = buildChatMessages(
      contract.contract_text,
      historyMessages || [],
      message
    )

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: parseFloat(process.env.OPENAI_CHAT_TEMPERATURE || '0.4'),
      max_tokens: 1000,
      messages: chatMessages as any,
    })

    const assistantContent = response.choices[0]?.message?.content || ''
    const pageCitation = extractPageCitation(assistantContent)

    // Store assistant message
    const { data: assistantMessage } = await supabase
      .from('chat_messages')
      .insert({
        session_id: session.id,
        role: 'assistant',
        content: assistantContent,
        page_citation: pageCitation,
      })
      .select()
      .single()

    return NextResponse.json({
      message: assistantMessage,
    })

  } catch (error) {
    console.error('Chat error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}
```

---

### `src/components/chat/chat-interface.tsx`

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@/hooks/use-chat'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'

interface ChatInterfaceProps {
  contractId: string
  onPageClick: (page: number) => void
}

export function ChatInterface({ contractId, onPageClick }: ChatInterfaceProps) {
  const { messages, isLoading, sendMessage, isSending } = useChat(contractId)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (content: string) => {
    await sendMessage(content)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>Ask a question about this contract</p>
            <p className="text-sm mt-2">
              Try: "What is the termination notice period?"
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onPageClick={onPageClick}
              />
            ))}
          </div>
        )}

        {isSending && (
          <div className="flex items-center gap-2 text-muted-foreground mt-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Thinking...</span>
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-4">
        <ChatInput onSend={handleSend} disabled={isSending} />
      </div>
    </div>
  )
}
```

---

### `src/components/chat/page-citation.tsx`

```typescript
'use client'

import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'

interface PageCitationProps {
  page: number
  onClick: (page: number) => void
}

export function PageCitation({ page, onClick }: PageCitationProps) {
  return (
    <Button
      variant="link"
      size="sm"
      className="inline-flex items-center gap-1 p-0 h-auto text-primary"
      onClick={() => onClick(page)}
    >
      <FileText className="h-3 w-3" />
      Page {page}
    </Button>
  )
}
```

---

### `src/hooks/use-chat.ts`

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  page_citation: number | null
  created_at: string
}

export function useChat(contractId: string) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['chat', contractId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/chat`)
      if (!res.ok) throw new Error('Failed to fetch chat')
      return res.json()
    },
  })

  const mutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/contracts/${contractId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) throw new Error('Failed to send message')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', contractId] })
    },
  })

  return {
    messages: data?.messages || [] as ChatMessage[],
    isLoading,
    sendMessage: mutation.mutateAsync,
    isSending: mutation.isPending,
  }
}
```

---

## Guardrails

| Guardrail | Implementation |
|-----------|----------------|
| Grounding | System prompt: "Answer ONLY from the contract text" |
| No hallucination | "I cannot find this information in the document" |
| Citation required | "Always include [Page X] citation" |
| Prefix required | "Always prefix with 'Based on the document...'" |
| Message limit | Max 200 messages in context |
| Message length | Max 2000 characters per user message |

---

## Acceptance Criteria

- [ ] User can type and send messages
- [ ] Responses grounded in document text only
- [ ] Each response includes [Page X] citation
- [ ] "Cannot find" response for absent information
- [ ] Page citation is clickable
- [ ] Clicking citation scrolls PDF viewer to page
- [ ] Chat history persists across page refreshes
- [ ] Chat history loads when revisiting contract
- [ ] Response latency ≤ 15 seconds P95
- [ ] Loading indicator shown while AI responds
- [ ] Empty state with example questions
- [ ] Error state with retry option
