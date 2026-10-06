# Feedback Specification

## Overview

Users can submit feedback on contract analyses using a thumbs up/down rating with optional comments. Feedback is stored per contract and used to improve the AI extraction.

---

## User Flow

```
1. User on Results Page (/contracts/[id])
2. User sees feedback form below key terms or in footer
3. User clicks thumbs up (1) or thumbs down (-1)
4. User optionally enters a text comment
5. User clicks "Submit Feedback"
6. POST /api/feedback with rating and comment
7. Backend validates and stores feedback
8. Frontend shows "Thank you for your feedback"
9. Form is replaced with confirmation message
```

---

## UI Design

### Before Submission

```
┌─────────────────────────────────────────────────────────────────┐
│  How was this analysis?                                         │
│                                                                 │
│      [👍]      [👎]                                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Add a comment (optional)                                    ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                                    [Submit Feedback]            │
└─────────────────────────────────────────────────────────────────┘
```

### After Submission

```
┌─────────────────────────────────────────────────────────────────┐
│  ✓ Thank you for your feedback!                                 │
│                                                                 │
│  Your input helps us improve contract analysis.                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/feedback/feedback-form.tsx` | Feedback form component |
| `src/app/api/feedback/route.ts` | Feedback API endpoint |
| `src/lib/validation/feedback-schemas.ts` | Zod validation schemas |

---

### `src/lib/validation/feedback-schemas.ts`

```typescript
import { z } from 'zod'

export const feedbackRequestSchema = z.object({
  contract_id: z.string().uuid(),
  rating: z.enum(['-1', '1']).transform(Number) as z.ZodType<-1 | 1>,
  comment: z.string().max(1000).optional(),
})

export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>
```

---

### `src/app/api/feedback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { feedbackRequestSchema } from '@/lib/validation/feedback-schemas'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate body
    const body = await request.json()
    const { contract_id, rating, comment } = feedbackRequestSchema.parse(body)

    // Verify contract exists and belongs to user
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, user_id')
      .eq('id', contract_id)
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    if (contract.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if feedback already exists (upsert)
    const { data: existingFeedback } = await supabase
      .from('user_feedback')
      .select('id')
      .eq('user_id', user.id)
      .eq('contract_id', contract_id)
      .single()

    let feedback

    if (existingFeedback) {
      // Update existing feedback
      const { data, error } = await supabase
        .from('user_feedback')
        .update({ rating, comment })
        .eq('id', existingFeedback.id)
        .select()
        .single()

      if (error) throw error
      feedback = data
    } else {
      // Insert new feedback
      const { data, error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: user.id,
          contract_id,
          rating,
          comment,
        })
        .select()
        .single()

      if (error) throw error
      feedback = data
    }

    return NextResponse.json({
      feedback: {
        id: feedback.id,
        created_at: feedback.created_at,
      },
    }, { status: existingFeedback ? 200 : 201 })

  } catch (error) {
    console.error('Feedback error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

### `src/components/feedback/feedback-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ThumbsUp, ThumbsDown, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeedbackFormProps {
  contractId: string
}

export function FeedbackForm({ contractId }: FeedbackFormProps) {
  const [rating, setRating] = useState<1 | -1 | null>(null)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const mutation = useMutation({
    mutationFn: async (data: { rating: number; comment?: string }) => {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          rating: data.rating.toString(),
          comment: data.comment || undefined,
        }),
      })
      if (!res.ok) throw new Error('Failed to submit feedback')
      return res.json()
    },
    onSuccess: () => {
      setSubmitted(true)
    },
  })

  const handleSubmit = () => {
    if (rating === null) return
    mutation.mutate({ rating, comment })
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-600">
            <Check className="h-5 w-5" />
            <span className="font-medium">Thank you for your feedback!</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Your input helps us improve contract analysis.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          How was this analysis?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="lg"
            variant={rating === 1 ? 'default' : 'outline'}
            onClick={() => setRating(1)}
            className={cn(
              rating === 1 && 'bg-green-600 hover:bg-green-700'
            )}
          >
            <ThumbsUp className="h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant={rating === -1 ? 'default' : 'outline'}
            onClick={() => setRating(-1)}
            className={cn(
              rating === -1 && 'bg-red-600 hover:bg-red-700'
            )}
          >
            <ThumbsDown className="h-5 w-5" />
          </Button>
        </div>

        <Textarea
          placeholder="Add a comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
        />

        <Button
          onClick={handleSubmit}
          disabled={rating === null || mutation.isPending}
          className="w-full"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Feedback'
          )}
        </Button>

        {mutation.isError && (
          <p className="text-sm text-destructive">
            Failed to submit feedback. Please try again.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## Database Schema Reference

```sql
CREATE TABLE user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating IN (-1, 1)),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, contract_id)
);
```

---

## Acceptance Criteria

- [ ] Feedback form appears on results page
- [ ] User can click thumbs up or thumbs down
- [ ] Selected thumb button shows active state
- [ ] Comment field is optional
- [ ] Comment limited to 1000 characters
- [ ] Submit button disabled until rating selected
- [ ] Loading state shown during submission
- [ ] Success message replaces form after submit
- [ ] Feedback stored in database
- [ ] User can only submit one feedback per contract
- [ ] Updating existing feedback works (upsert)
- [ ] Error state shown on failure
- [ ] Only contract owner can submit feedback
