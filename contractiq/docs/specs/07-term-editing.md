# Inline Term Editing Specification

## Overview

Users can edit extracted key term values directly from the results page. Original AI-extracted values are preserved for reference. Edited terms are marked with an "Edited" badge.

---

## User Flow

```
1. User on Results Page (/contracts/[id])
2. User clicks edit icon on a key term
3. Inline input appears with current value
4. User modifies value
5. User clicks Save (checkmark) or Cancel (X)
6. On Save:
   - Frontend: Optimistic update to UI
   - Backend: PATCH /api/contracts/[id]/terms/[termId]
   - Database: Update value, set is_edited=true, preserve original_value
7. On success: "Edited" badge appears on term
8. On error: Revert to original, show error toast
```

---

## API Route

### PATCH /api/contracts/[id]/terms/[termId]

**File:** `app/api/contracts/[id]/terms/[termId]/route.ts`

**Request Body:**
```json
{
  "value": "string"
}
```

**Success Response (200):**
```json
{
  "term": {
    "id": "uuid",
    "term_name": "Governing Law",
    "value": "State of California",
    "is_edited": true,
    "original_value": "State of Delaware"
  }
}
```

**Error Responses:**

| Status | Error | Condition |
|--------|-------|-----------|
| 400 | "Value is required." | Empty value |
| 401 | "Unauthorized" | No valid session |
| 403 | "Forbidden" | Contract belongs to another user |
| 404 | "Term not found." | Invalid term ID |
| 500 | "Failed to update term." | Database error |

**Implementation:**
```typescript
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; termId: string } }
) {
  const supabase = await createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { value } = await request.json()

  // Validate value
  if (typeof value !== 'string') {
    return Response.json({ error: 'Value is required.' }, { status: 400 })
  }

  // Fetch term with contract ownership check
  const { data: term, error: fetchError } = await supabase
    .from('key_terms')
    .select(`
      *,
      contracts!inner (user_id)
    `)
    .eq('id', params.termId)
    .eq('contract_id', params.id)
    .single()

  if (fetchError || !term) {
    return Response.json({ error: 'Term not found.' }, { status: 404 })
  }

  // Check ownership
  if (term.contracts.user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prepare update
  const updateData: Record<string, any> = {
    value,
    is_edited: true,
  }

  // Preserve original value on first edit
  if (!term.is_edited && !term.original_value) {
    updateData.original_value = term.value
  }

  // Update term
  const { data: updatedTerm, error: updateError } = await supabase
    .from('key_terms')
    .update(updateData)
    .eq('id', params.termId)
    .select()
    .single()

  if (updateError) {
    return Response.json({ error: 'Failed to update term.' }, { status: 500 })
  }

  return Response.json({ term: updatedTerm })
}
```

---

## Service Module

**File:** `lib/contracts/terms.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { KeyTerm } from '@/types'

export async function updateTerm(
  supabase: SupabaseClient,
  termId: string,
  value: string,
  currentTerm: KeyTerm
): Promise<KeyTerm> {
  const updateData: Record<string, any> = {
    value,
    is_edited: true,
  }

  // Preserve original value on first edit
  if (!currentTerm.is_edited && !currentTerm.original_value) {
    updateData.original_value = currentTerm.value
  }

  const { data, error } = await supabase
    .from('key_terms')
    .update(updateData)
    .eq('id', termId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getTermsByContractId(
  supabase: SupabaseClient,
  contractId: string
): Promise<KeyTerm[]> {
  const { data, error } = await supabase
    .from('key_terms')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}
```

---

## Frontend Implementation

### KeyTermRow Edit Mode

**File:** `components/contracts/key-term-row.tsx`

The edit functionality is inline within the KeyTermRow component:

```typescript
'use client'

import { useState } from 'react'
import { Check, Edit2, X, Undo } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface KeyTermRowProps {
  term: KeyTerm
  onEdit: (termId: string, value: string) => Promise<void>
  isEditing?: boolean
}

export function KeyTermRow({ term, onEdit, isEditing = false }: KeyTermRowProps) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [editValue, setEditValue] = useState(term.value || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onEdit(term.id, editValue)
      setIsEditMode(false)
    } catch (error) {
      // Revert on error
      setEditValue(term.value || '')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(term.value || '')
    setIsEditMode(false)
  }

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{term.term_name}</span>
            {term.is_edited && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1">
                    Edited
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Original: "{term.original_value}"</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {isEditMode ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                  if (e.key === 'Escape') handleCancel()
                }}
              />
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              {term.value || <span className="italic">Not found</span>}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isEditMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditMode(true)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
```

### Hook Integration

**File:** `hooks/use-contract.ts`

```typescript
const editTermMutation = useMutation({
  mutationFn: async ({ termId, value }: { termId: string; value: string }) => {
    const res = await fetch(`/api/contracts/${contractId}/terms/${termId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to update term')
    }
    return res.json()
  },
  onMutate: async ({ termId, value }) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['contract', contractId] })

    // Snapshot previous value
    const previous = queryClient.getQueryData(['contract', contractId])

    // Optimistic update
    queryClient.setQueryData(['contract', contractId], (old: any) => ({
      ...old,
      terms: old.terms.map((t: KeyTerm) =>
        t.id === termId
          ? {
              ...t,
              value,
              is_edited: true,
              original_value: t.original_value || t.value,
            }
          : t
      ),
    }))

    return { previous }
  },
  onError: (err, variables, context) => {
    // Revert on error
    queryClient.setQueryData(['contract', contractId], context?.previous)
    toast.error('Failed to update term')
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
  },
})
```

---

## Database Changes

On edit, the following columns are updated:

| Column | Update |
|--------|--------|
| value | New user-provided value |
| is_edited | Set to `true` |
| original_value | Preserved original AI value (only on first edit) |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Empty value saved | Allow (term may genuinely not exist) |
| Same value as original | Still mark as edited for audit |
| Edit already-edited term | Update value, keep original_value |
| Network error during save | Revert to previous value, show error toast |
| Cancel before save | Revert input to current value |
| Rapid consecutive edits | Queue edits, debounce API calls |

---

## Acceptance Criteria

- [ ] Click edit icon shows inline input with current value
- [ ] Enter key saves, Escape key cancels
- [ ] Save/Cancel buttons work correctly
- [ ] Original AI value preserved in original_value column
- [ ] "Edited" badge shown on modified terms
- [ ] Tooltip on "Edited" badge shows original value
- [ ] Save completes within 2 seconds
- [ ] Optimistic update shows immediately
- [ ] Error reverts to original value with toast notification
