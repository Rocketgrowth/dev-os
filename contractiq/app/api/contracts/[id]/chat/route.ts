import { createClient } from '@/lib/supabase/server'
import { callChatAPI } from '@/lib/openai/client'
import { buildChatPrompt } from '@/lib/openai/prompts/chat'
import { parseChatResponse } from '@/lib/openai/parse-response'
import { sendMessageSchema } from '@/lib/validation/schemas'
import {
  requireAuth,
  isAuthError,
  checkRateLimit,
  createRateLimitResponse,
  sanitizeForLLM,
  createPromptInjectionResponse,
  verifyChatAccess,
  truncateChatHistory,
} from '@/lib/security'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Authenticate
    const auth = await requireAuth()
    if (isAuthError(auth)) {
      return auth.response
    }
    const { user, supabase } = auth

    // Verify contract ownership
    const { data: contract } = await supabase
      .from('contracts')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!contract || contract.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Contract not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Get chat session and messages
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('contract_id', id)
      .single()

    if (!session) {
      return NextResponse.json({ session: null, messages: [] })
    }

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      session,
      messages: messages || [],
    })
  } catch (error) {
    console.error('Chat history error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Authenticate
    const auth = await requireAuth()
    if (isAuthError(auth)) {
      return auth.response
    }
    const { user, supabase } = auth

    // Check rate limit
    const rateLimitResult = await checkRateLimit(user.id, 'chat')
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }

    // Validate request body
    const body = await request.json()
    const parsed = sendMessageSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
        { status: 422 }
      )
    }

    // Verify chat access (ownership + status + text available)
    const access = await verifyChatAccess(supabase, id, user.id)
    if (!access.valid || !access.contract) {
      return access.error!
    }

    const { contract } = access

    // Check for prompt injection
    const sanitization = sanitizeForLLM(parsed.data.message)
    if (!sanitization.safe) {
      console.warn('Prompt injection detected:', {
        userId: user.id,
        contractId: id,
        patterns: sanitization.detectedPatterns,
      })
      return createPromptInjectionResponse()
    }

    const userMessage = sanitization.sanitized.trim()

    // Get or create chat session
    const { data: existingSession } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('contract_id', id)
      .single()

    let sessionId: string

    if (existingSession) {
      sessionId = existingSession.id
    } else {
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({ contract_id: id })
        .select()
        .single()

      if (sessionError || !newSession) {
        console.error('Session creation error:', sessionError)
        return NextResponse.json(
          { error: 'Failed to create chat session.', code: 'SESSION_ERROR' },
          { status: 500 }
        )
      }
      sessionId = newSession.id
    }

    // Get chat history and truncate to limit
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    const truncatedHistory = truncateChatHistory(history || [])

    // Save user message
    const { error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: userMessage,
      })

    if (userMsgError) {
      console.error('User message save error:', userMsgError)
    }

    // Call AI
    try {
      const prompt = buildChatPrompt({
        contractText: contract.contract_text!,
        conversationHistory: truncatedHistory,
        userMessage,
      })

      const response = await callChatAPI(prompt)
      const { content, pageCitation } = parseChatResponse(response)

      // Save assistant message
      const { data: assistantMessage, error: assistantMsgError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          role: 'assistant',
          content,
          page_citation: pageCitation,
        })
        .select()
        .single()

      if (assistantMsgError) {
        console.error('Assistant message save error:', assistantMsgError)
        return NextResponse.json(
          { error: 'Failed to save response.', code: 'SAVE_ERROR' },
          { status: 500 }
        )
      }

      return NextResponse.json({ message: assistantMessage })
    } catch (error) {
      console.error('Chat AI error:', error)
      return NextResponse.json(
        { error: 'Failed to get response. Please try again.', code: 'AI_ERROR' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
