interface ChatMessage {
  role: string
  content: string
}

interface ChatPromptParams {
  contractText: string
  conversationHistory: ChatMessage[]
  userMessage: string
}

export function buildChatPrompt(
  params: ChatPromptParams
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const { contractText, conversationHistory, userMessage } = params

  const systemPrompt = `You are a contract analysis assistant. Answer questions using ONLY the contract text provided below. Do not use any external knowledge or make assumptions.

RULES:
1. If the answer is in the document, provide it with a [Page X] citation at the end of your response
2. If the answer is NOT in the document, respond: "I cannot find this information in the document."
3. Always start your answer with "Based on the document..."
4. Be concise and direct
5. Look for [PAGE N] markers in the text to determine page numbers
6. ALWAYS include a page citation in brackets at the end of your response, like [Page 3]
7. If information spans multiple pages, cite all relevant pages

Contract Text:
${contractText}`

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] =
    [{ role: 'system', content: systemPrompt }]

  for (const msg of conversationHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })
    }
  }

  messages.push({ role: 'user', content: userMessage })

  return messages
}
