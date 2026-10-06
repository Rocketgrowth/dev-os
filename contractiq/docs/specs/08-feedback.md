# Feedback Collection Specification

## Overview

Users can submit thumbs up/down feedback on contract analyses with an optional text comment. Feedback is stored for product improvement and model evaluation.

---

## User Flow

```
1. User on Results Page (/contracts/[id])
2. User sees feedback section at bottom of page
3. User clicks thumbs up or thumbs down
4. Optional: text input appears for comment
5. User clicks "Submit Feedback"
6. Backend: POST /api/feedback
7. Database: INSERT into user_feedback table
8. UI: Shows "Thank you for your feedback!" confirmation
```

---

## API Route

### POST /api/feedback

**File:** `app/api/feedback/route.ts`

**Request Body:**
```json
{
  "contract_id": "uuid",
  "rating": 1,
  "comment": "string (optional)"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| contract_id | uuid | Yes | Contract being rated |
| rating | integer | Yes | -1 (thumbs down) or 1 (thumbs up) |
| comment | string | No | Optional text feedback |

**Success Response (201):**
```json
{
  "feedback": {
    "id": "uuid",
    "created_at": "2024-01-15T10:45:00Z"
  }
}
```

**Error Responses:**

| Status | Error | Condition |
|--------|-------|-----------|
| 400 | "Contract ID is required." | Missing contract_id |
| 400 | "Invalid rating. Must be -1 or 1." | Invalid rating value |
| 401 | "Unauthorized" | No valid session |
| 403 | "Forbidden" | Contract belongs to another user |
| 404 | "Contract not found." | Invalid contract ID |
| 500 | "Failed to submit feedback." | Database error |

**Implementation:**
```typescript
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const feedbackSchema = z.object({
  contract_id: z.string().uuid('Invalid contract ID'),
  rating: z.number().refine(v => v === -1 || v === 1, {
    message: 'Invalid rating. Must be -1 or 1.',
  }),
  comment: z.string().max(1000).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = feedbackSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  const { contract_id, rating, comment } = parsed.data

  // Verify contract exists and belongs to user
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, user_id')
    .eq('id', contract_id)
    .single()

  if (contractError || !contract) {
    return Response.json({ error: 'Contract not found.' }, { status: 404 })
  }

  if (contract.user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check for existing feedback (allow one per contract per user)
  const { data: existing } = await supabase
    .from('user_feedback')
    .select('id')
    .eq('user_id', user.id)
    .eq('contract_id', contract_id)
    .single()

  if (existing) {
    // Update existing feedback
    const { data: updated, error: updateError } = await supabase
      .from('user_feedback')
      .update({ rating, comment })
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) {
      return Response.json({ error: 'Failed to update feedback.' }, { status: 500 })
    }

    return Response.json({ feedback: updated })
  }

  // Insert new feedback
  const { data: feedback, error: insertError } = await supabase
    .from('user_feedback')
    .insert({
      user_id: user.id,
      contract_id,
      rating,
      comment,
    })
    .select()
    .single()

  if (insertError) {
    return Response.json({ error: 'Failed to submit feedback.' }, { status: 500 })
  }

  return Response.json({ feedback }, { status: 201 })
}
```

---

## Frontend Component

### FeedbackForm Component

**File:** `components/feedback/feedback-form.tsx`

**Props:**
```typescript
interface FeedbackFormProps {
  contractId: string
}
```

**States:**
1. Initial: Thumbs up/down buttons visible
2. Selected: Show comment textarea + submit button
3. Submitted: Show "Thank you" message
4. Error: Show error with retry

**Implementation:**
```typescript
'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface FeedbackFormProps {
  contractId: string
}

export function FeedbackForm({ contractId }: FeedbackFormProps) {
  const [rating, setRating] = useState<1 | -1 | null>(null)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRatingClick = (value: 1 | -1) => {
    setRating(rating === value ? null : value)
    setError(null)
  }

  const handleSubmit = async () => {
    if (!rating) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          rating,
          comment: comment.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit feedback')
      }

      setIsSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-green-600">✓</span>
        Thank you for your feedback!
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Was this analysis helpful?
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRatingClick(1)}
          className={cn(
            rating === 1 && 'bg-green-100 text-green-700 hover:bg-green-100'
          )}
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRatingClick(-1)}
          className={cn(
            rating === -1 && 'bg-red-100 text-red-700 hover:bg-red-100'
          )}
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>

      {rating !== null && (
        <div className="flex gap-2">
          <Textarea
            placeholder="Any additional feedback? (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[60px] text-sm"
            maxLength={1000}
          />
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            size="sm"
          >
            {isSubmitting ? (
              <span className="animate-pulse">...</span>
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                Submit
              </>
            )}
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
```

---

## Database Schema

Table: `user_feedback`

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| user_id | uuid | REFERENCES auth.users(id) |
| contract_id | uuid | REFERENCES contracts(id) |
| rating | integer | CHECK (rating IN (-1, 1)) |
| comment | text | nullable |
| created_at | timestamptz | DEFAULT now() |

**Unique Constraint:** One feedback per user per contract
```sql
CREATE UNIQUE INDEX idx_user_feedback_unique ON user_feedback (user_id, contract_id);
```

---

## Hooks

### useFeedback Hook

**File:** `hooks/use-feedback.ts`

```typescript
import { useMutation, useQuery } from '@tanstack/react-query'

export function useFeedback(contractId: string) {
  const { data: existingFeedback } = useQuery({
    queryKey: ['feedback', contractId],
    queryFn: async () => {
      // Could add GET /api/contracts/[id]/feedback endpoint
      return null
    },
    enabled: false, // Disable if not needed
  })

  const submitMutation = useMutation({
    mutationFn: async ({
      rating,
      comment,
    }: {
      rating: 1 | -1
      comment?: string
    }) => {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_id: contractId, rating, comment }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      return res.json()
    },
  })

  return {
    existingFeedback,
    submit: submitMutation.mutate,
    isSubmitting: submitMutation.isPending,
    isSubmitted: submitMutation.isSuccess,
    error: submitMutation.error?.message,
  }
}
```

---

## Analytics Use Cases

The feedback data enables:

1. **Model Evaluation:** Track extraction accuracy via thumbs up/down ratio
2. **Feature Prioritization:** Analyze comments for common issues
3. **A/B Testing:** Compare feedback across different prompt versions
4. **User Satisfaction:** Monitor overall satisfaction trends

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User submits twice | Update existing feedback |
| Very long comment | Truncate at 1000 characters |
| Network error | Show error, allow retry |
| Contract deleted | Feedback remains (orphaned is OK) |
| Change rating after submit | Allow re-submission (updates) |

---

## Acceptance Criteria

- [ ] Thumbs up/down buttons displayed on results page
- [ ] Rating selection highlighted
- [ ] Comment textarea appears after rating selection
- [ ] Comment is optional (can submit with just rating)
- [ ] Submit button sends feedback to API
- [ ] Success shows "Thank you" message
- [ ] Error shows error message with ability to retry
- [ ] One feedback per user per contract (update if exists)
