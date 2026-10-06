import { ChatMessage as ChatMessageType } from '@/types'
import { cn } from '@/lib/utils'
import { PageCitation } from './page-citation'

interface ChatMessageProps {
  message: ChatMessageType
  onPageClick?: (page: number) => void
}

export function ChatMessage({ message, onPageClick }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.page_citation && (
          <div className="mt-2">
            <PageCitation
              page={message.page_citation}
              onClick={() => onPageClick?.(message.page_citation!)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
