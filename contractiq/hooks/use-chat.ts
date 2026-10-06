'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChatMessage, ChatSession } from '@/types'

interface ChatHistoryResponse {
  session: ChatSession | null
  messages: ChatMessage[]
}

interface SendMessageResponse {
  message: ChatMessage
}

async function fetchChatHistory(contractId: string): Promise<ChatHistoryResponse> {
  const response = await fetch(`/api/contracts/${contractId}/chat`)
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to load chat')
  }
  return response.json()
}

async function sendChatMessage(
  contractId: string,
  message: string
): Promise<SendMessageResponse> {
  const response = await fetch(`/api/contracts/${contractId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to send message')
  }
  return response.json()
}

export function useChat(contractId: string) {
  const queryClient = useQueryClient()

  const historyQuery = useQuery({
    queryKey: ['chat', contractId],
    queryFn: () => fetchChatHistory(contractId),
    enabled: !!contractId,
  })

  const sendMutation = useMutation({
    mutationFn: (message: string) => sendChatMessage(contractId, message),
    onMutate: async (message) => {
      await queryClient.cancelQueries({ queryKey: ['chat', contractId] })

      const previous = queryClient.getQueryData<ChatHistoryResponse>([
        'chat',
        contractId,
      ])

      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        session_id: previous?.session?.id || '',
        role: 'user',
        content: message,
        page_citation: null,
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData<ChatHistoryResponse>(
        ['chat', contractId],
        (old) => ({
          session: old?.session || null,
          messages: [...(old?.messages || []), optimisticMessage],
        })
      )

      return { previous }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<ChatHistoryResponse>(
        ['chat', contractId],
        (old) => ({
          session: old?.session || null,
          messages: [...(old?.messages || []), data.message],
        })
      )
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['chat', contractId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', contractId] })
    },
  })

  return {
    messages: historyQuery.data?.messages || [],
    session: historyQuery.data?.session,
    isLoadingHistory: historyQuery.isLoading,
    isLoading: sendMutation.isPending,
    error: sendMutation.error?.message || null,
    sendMessage: sendMutation.mutate,
  }
}
