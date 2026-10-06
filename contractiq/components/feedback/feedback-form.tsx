'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface FeedbackFormProps {
  contractId: string
  onSubmit: (rating: -1 | 1, comment?: string) => Promise<void>
}

export function FeedbackForm({ contractId, onSubmit }: FeedbackFormProps) {
  const [rating, setRating] = useState<-1 | 1 | null>(null)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!rating) return

    setIsSubmitting(true)
    try {
      await onSubmit(rating, comment || undefined)
      setIsSubmitted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground">
          Thank you for your feedback!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">
          Was this analysis helpful?
        </p>
        <div className="flex gap-2">
          <Button
            variant={rating === 1 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRating(1)}
            className={cn(rating === 1 && 'bg-green-600 hover:bg-green-700')}
          >
            <ThumbsUp className="h-4 w-4 mr-1" />
            Yes
          </Button>
          <Button
            variant={rating === -1 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRating(-1)}
            className={cn(rating === -1 && 'bg-red-600 hover:bg-red-700')}
          >
            <ThumbsDown className="h-4 w-4 mr-1" />
            No
          </Button>
        </div>
      </div>

      {rating !== null && (
        <>
          <div>
            <Textarea
              placeholder="Any additional feedback? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="h-20"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            size="sm"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Feedback
          </Button>
        </>
      )}
    </div>
  )
}
