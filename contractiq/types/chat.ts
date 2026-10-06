export type MessageRole = 'user' | 'assistant'

export interface ChatSession {
  id: string
  contract_id: string
  created_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: MessageRole
  content: string
  page_citation: number | null
  created_at: string
}

export interface SendMessageInput {
  message: string
}

export interface ChatResponse {
  message: ChatMessage
}
