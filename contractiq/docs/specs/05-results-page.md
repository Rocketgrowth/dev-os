# Results Page Specification

## Overview

The results page displays extracted key terms alongside a PDF viewer. Users can view confidence scores, source sentences, edit terms, chat with the contract, and submit feedback.

---

## User Flow

```
1. User completes contract processing
2. Redirect to /contracts/[id]
3. Page loads with two-panel layout:
   - Left: PDF viewer (or text fallback)
   - Right: Key terms panel
4. User can:
   - Click term page number → PDF scrolls to page
   - Expand "Why?" to see source sentence
   - Edit term values inline
   - Click "Chat" tab to ask questions
   - Submit thumbs up/down feedback
```

---

## API Route

### GET /api/contracts/[id]

**File:** `app/api/contracts/[id]/route.ts`

**Success Response (200):**
```json
{
  "contract": {
    "id": "uuid",
    "name": "Vendor NDA.pdf",
    "type": "nda",
    "status": "completed",
    "contract_text": "...",
    "file_path": "user-id/contract-id/Vendor NDA.pdf",
    "file_url": "https://...signed-url...",
    "page_count": 12,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "terms": [
    {
      "id": "uuid",
      "term_name": "Governing Law",
      "value": "State of Delaware",
      "page_number": 4,
      "confidence_score": 0.92,
      "source_sentence": "This Agreement shall be governed by...",
      "is_manual": false,
      "is_edited": false,
      "original_value": null
    }
  ]
}
```

**Implementation:**
```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch contract
  const { data: contract, error: fetchError } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchError || !contract) {
    return Response.json({ error: 'Contract not found.' }, { status: 404 })
  }

  // Check ownership
  if (contract.user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Generate signed URL for PDF (if file_path exists)
  let fileUrl = null
  if (contract.file_path) {
    const { data } = await supabase.storage
      .from('contracts')
      .createSignedUrl(contract.file_path, 3600) // 1 hour expiry
    fileUrl = data?.signedUrl
  }

  // Fetch key terms
  const { data: terms } = await supabase
    .from('key_terms')
    .select('*')
    .eq('contract_id', params.id)
    .order('created_at', { ascending: true })

  return Response.json({
    contract: { ...contract, file_url: fileUrl },
    terms: terms || [],
  })
}
```

---

## Page Layout

**File:** `app/(dashboard)/contracts/[id]/page.tsx`

**Structure:**
```
┌────────────────────────────────────────────────────────────┐
│ Header: Contract Name | Type Badge | Status                │
├──────────────────────────────┬─────────────────────────────┤
│                              │ Tabs: Terms | Chat          │
│                              ├─────────────────────────────┤
│     PDF Viewer               │                             │
│     (or Text Viewer)         │     Key Terms Panel         │
│                              │     (or Chat Interface)     │
│                              │                             │
│                              │                             │
├──────────────────────────────┴─────────────────────────────┤
│ Footer: Feedback Form | "Not legal advice" disclaimer      │
└────────────────────────────────────────────────────────────┘
```

**Implementation:**
```typescript
'use client'

import { useState } from 'react'
import { useContract } from '@/hooks/use-contract'
import { PDFViewer } from '@/components/contracts/pdf-viewer'
import { TextViewer } from '@/components/contracts/text-viewer'
import { KeyTermsPanel } from '@/components/contracts/key-terms-panel'
import { ChatInterface } from '@/components/chat/chat-interface'
import { FeedbackForm } from '@/components/feedback/feedback-form'
import { Disclaimer } from '@/components/shared/disclaimer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

export default function ContractResultsPage({
  params,
}: {
  params: { id: string }
}) {
  const { contract, terms, isLoading, error } = useContract(params.id)
  const [currentPage, setCurrentPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'terms' | 'chat'>('terms')

  const handlePageClick = (page: number) => {
    setCurrentPage(page)
  }

  if (isLoading) return <ContractSkeleton />
  if (error) return <ErrorState error={error} />
  if (!contract) return <NotFound />

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{contract.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{contract.type.toUpperCase()}</Badge>
            <span className="text-sm text-muted-foreground">
              {contract.page_count} pages
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: PDF/Text viewer */}
        <div className="w-1/2 border-r overflow-hidden">
          {contract.file_url ? (
            <PDFViewer
              url={contract.file_url}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          ) : (
            <TextViewer
              text={contract.contract_text}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          )}
        </div>

        {/* Right panel: Terms/Chat */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="w-full justify-start border-b rounded-none p-0">
              <TabsTrigger value="terms" className="rounded-none">
                Key Terms
              </TabsTrigger>
              <TabsTrigger value="chat" className="rounded-none">
                Chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="terms" className="flex-1 overflow-auto m-0">
              <KeyTermsPanel
                terms={terms}
                contractId={contract.id}
                onPageClick={handlePageClick}
              />
            </TabsContent>

            <TabsContent value="chat" className="flex-1 overflow-hidden m-0">
              <ChatInterface
                contractId={contract.id}
                onPageClick={handlePageClick}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="flex items-center justify-between">
          <FeedbackForm contractId={contract.id} />
          <Disclaimer />
        </div>
      </div>
    </div>
  )
}
```

---

## Frontend Components

### PDFViewer Component

**File:** `components/contracts/pdf-viewer.tsx`

**Props:**
```typescript
interface PDFViewerProps {
  url: string
  currentPage: number
  onPageChange: (page: number) => void
}
```

**Features:**
- PDF.js for rendering
- Page navigation controls
- Zoom controls
- Scroll to page programmatically
- Page number display

**Implementation:**
```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

export function PDFViewer({ url, currentPage, onPageChange }: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const containerRef = useRef<HTMLDivElement>(null)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  const goToPrevPage = () => {
    if (currentPage > 1) onPageChange(currentPage - 1)
  }

  const goToNextPage = () => {
    if (currentPage < numPages) onPageChange(currentPage + 1)
  }

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 2.0))
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5))

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goToPrevPage} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {numPages}
          </span>
          <Button variant="ghost" size="sm" onClick={goToNextPage} disabled={currentPage >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF content */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4">
        <Document file={url} onLoadSuccess={onDocumentLoadSuccess}>
          <Page pageNumber={currentPage} scale={scale} />
        </Document>
      </div>
    </div>
  )
}
```

### TextViewer Component

**File:** `components/contracts/text-viewer.tsx`

**Props:**
```typescript
interface TextViewerProps {
  text: string
  currentPage: number
  onPageChange: (page: number) => void
}
```

**Features:**
- Paginated text display based on [PAGE N] markers
- Page navigation controls
- Scroll to page programmatically

### KeyTermsPanel Component

**File:** `components/contracts/key-terms-panel.tsx`

**Props:**
```typescript
interface KeyTermsPanelProps {
  terms: KeyTerm[]
  contractId: string
  onPageClick: (page: number) => void
}
```

**Features:**
- List of all extracted terms
- Grouped by confidence level (high, medium, low)
- Each term shows: name, value, page, confidence badge
- Expandable source sentence ("Why?")
- Inline edit functionality

### KeyTermRow Component

**File:** `components/contracts/key-term-row.tsx`

**Props:**
```typescript
interface KeyTermRowProps {
  term: KeyTerm
  onPageClick: (page: number) => void
  onEdit: (termId: string, newValue: string) => void
}
```

**Features:**
- Term name and value display
- Clickable page number
- Confidence badge (color-coded)
- "Why?" expand button for source sentence
- Edit button → inline input
- "Edited" badge if modified
- "Custom" badge if is_manual

**Implementation:**
```typescript
'use client'

import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, Edit2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfidenceBadge } from './confidence-badge'
import { cn } from '@/lib/utils'

export function KeyTermRow({ term, onPageClick, onEdit }: KeyTermRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(term.value || '')

  const handleSave = () => {
    onEdit(term.id, editValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(term.value || '')
    setIsEditing(false)
  }

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{term.term_name}</span>
            {term.is_manual && <Badge variant="secondary">Custom</Badge>}
            {term.is_edited && <Badge variant="outline">Edited</Badge>}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2 mt-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={handleSave}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              {term.value || <span className="italic">Not found</span>}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {term.page_number && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageClick(term.page_number!)}
              className="text-xs"
            >
              p.{term.page_number}
            </Button>
          )}
          <ConfidenceBadge score={term.confidence_score} />
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {term.source_sentence && (
        <div className="mt-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Why?
          </button>
          {isExpanded && (
            <p className="text-xs text-muted-foreground mt-1 pl-4 border-l-2">
              "{term.source_sentence}"
            </p>
          )}
        </div>
      )}
    </div>
  )
}
```

### ConfidenceBadge Component

**File:** `components/contracts/confidence-badge.tsx`

**Props:**
```typescript
interface ConfidenceBadgeProps {
  score: number | null
}
```

**Features:**
- Color-coded based on score:
  - Green (≥ 0.8): High confidence
  - Amber (0.5-0.79): Medium confidence
  - Red (< 0.5): Low confidence
- Warning icon for low confidence
- Tooltip showing exact percentage

**Implementation:**
```typescript
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  if (score === null) return null

  const percentage = Math.round(score * 100)
  const isHigh = score >= 0.8
  const isMedium = score >= 0.5 && score < 0.8
  const isLow = score < 0.5

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            'gap-1',
            isHigh && 'border-green-500 text-green-700 bg-green-50',
            isMedium && 'border-amber-500 text-amber-700 bg-amber-50',
            isLow && 'border-red-500 text-red-700 bg-red-50'
          )}
        >
          {isLow && <AlertTriangle className="h-3 w-3" />}
          {percentage}%
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {isHigh && 'High confidence'}
          {isMedium && 'Medium confidence - verify manually'}
          {isLow && 'Low confidence - requires verification'}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
```

### FeedbackForm Component

**File:** `components/feedback/feedback-form.tsx`

**Props:**
```typescript
interface FeedbackFormProps {
  contractId: string
}
```

**Features:**
- Thumbs up / thumbs down buttons
- Optional comment textarea (appears after rating)
- Submit button
- Success message after submission

### Disclaimer Component

**File:** `components/shared/disclaimer.tsx`

**Implementation:**
```typescript
export function Disclaimer() {
  return (
    <p className="text-xs text-muted-foreground">
      This analysis is not legal advice. Consult a lawyer for legal decisions.
    </p>
  )
}
```

---

## Hooks

### useContract Hook

**File:** `hooks/use-contract.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function useContract(contractId: string) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}`)
      if (!res.ok) throw new Error('Failed to load contract')
      return res.json()
    },
  })

  const editTermMutation = useMutation({
    mutationFn: async ({ termId, value }: { termId: string; value: string }) => {
      const res = await fetch(`/api/contracts/${contractId}/terms/${termId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
      if (!res.ok) throw new Error('Failed to update term')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    },
  })

  return {
    contract: data?.contract,
    terms: data?.terms || [],
    isLoading,
    error: error?.message,
    editTerm: editTermMutation.mutate,
    isEditingTerm: editTermMutation.isPending,
  }
}
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| PDF file not in storage | Show text viewer fallback |
| Signed URL expired | Refetch contract to get new URL |
| Contract still processing | Show processing state, poll for completion |
| Contract errored | Show error state with retry option |
| No terms extracted | Show empty state with explanation |
| Term value is null | Display "Not found" in italics |
| Edit save fails | Revert to original value, show error toast |

---

## Acceptance Criteria

- [ ] Two-panel layout: PDF viewer left, key terms right
- [ ] PDF renders with page navigation and zoom
- [ ] Text viewer fallback when PDF not available
- [ ] Each term shows: name, value, page number, confidence badge
- [ ] Confidence color-coded: green ≥80%, amber 50-79%, red <50%
- [ ] Low confidence terms show warning icon
- [ ] Expandable "Why?" shows source sentence
- [ ] Click page number → PDF scrolls to page
- [ ] Inline term editing with save/cancel
- [ ] Chat tab switches to chat interface
- [ ] Feedback form with thumbs up/down
- [ ] "Not legal advice" disclaimer visible
