# Results Page Specification

## Overview

The results page displays a processed contract with a two-panel layout: PDF viewer on the left, key terms on the right. Users can view terms, edit values, and chat with the contract.

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Header                                                      [User Menu]    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ← Back to Dashboard    Contract Name                                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌───────────────────────────────┐  ┌───────────────────────────────────┐  │
│  │                               │  │  [Key Terms]  [Chat]              │  │
│  │                               │  │  ─────────────────────────────────│  │
│  │                               │  │                                   │  │
│  │        PDF VIEWER             │  │  Parties                          │  │
│  │                               │  │  Acme Corp and Beta Inc           │  │
│  │      (or Text Fallback)       │  │  [95%] Page 1        [Edit] [Why?]│  │
│  │                               │  │  ─────────────────────────────────│  │
│  │                               │  │  Effective Date                   │  │
│  │                               │  │  January 15, 2024                 │  │
│  │   ┌─────────────────────┐     │  │  [88%] Page 1        [Edit] [Why?]│  │
│  │   │  Page 1 of 12       │     │  │  ─────────────────────────────────│  │
│  │   └─────────────────────┘     │  │  Governing Law                    │  │
│  │                               │  │  State of Delaware                │  │
│  │                               │  │  [72%] Page 4   ⚠️   [Edit] [Why?]│  │
│  │                               │  │  ─────────────────────────────────│  │
│  │                               │  │  ...                              │  │
│  │                               │  │                                   │  │
│  └───────────────────────────────┘  └───────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  ⚠️ This analysis is not legal advice. Consult a lawyer before signing. ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/(dashboard)/contracts/[id]/page.tsx` | Results page |
| `src/app/(dashboard)/contracts/[id]/loading.tsx` | Skeleton loader |
| `src/app/api/contracts/[id]/route.ts` | Get single contract API |
| `src/app/api/contracts/[id]/terms/[termId]/route.ts` | Edit term API |
| `src/components/contracts/pdf-viewer.tsx` | PDF.js wrapper |
| `src/components/contracts/text-viewer.tsx` | Text fallback viewer |
| `src/components/contracts/key-terms-panel.tsx` | Terms list container |
| `src/components/contracts/key-term-row.tsx` | Single term row |
| `src/components/contracts/confidence-badge.tsx` | Color-coded badge |
| `src/components/contracts/source-sentence.tsx` | Expandable "Why?" section |
| `src/components/shared/disclaimer.tsx` | "Not legal advice" banner |
| `src/hooks/use-contract.ts` | Single contract query |

---

### `src/app/(dashboard)/contracts/[id]/page.tsx`

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PdfViewer } from '@/components/contracts/pdf-viewer'
import { TextViewer } from '@/components/contracts/text-viewer'
import { KeyTermsPanel } from '@/components/contracts/key-terms-panel'
import { ChatInterface } from '@/components/chat/chat-interface'
import { Disclaimer } from '@/components/shared/disclaimer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ResultsPageProps {
  params: { id: string }
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch contract with key terms
  const { data: contract, error } = await supabase
    .from('contracts')
    .select(`
      *,
      key_terms (*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !contract) {
    notFound()
  }

  // Verify ownership
  if (contract.user_id !== user.id) {
    notFound()
  }

  // Get signed URL for PDF if available
  let pdfUrl: string | null = null
  if (contract.file_path) {
    const { data: signedUrl } = await supabase.storage
      .from('contracts')
      .createSignedUrl(contract.file_path, 3600) // 1 hour
    pdfUrl = signedUrl?.signedUrl || null
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{contract.name}</h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: PDF or Text Viewer */}
        <div className="w-1/2 border-r overflow-hidden">
          {pdfUrl ? (
            <PdfViewer url={pdfUrl} />
          ) : (
            <TextViewer text={contract.contract_text} />
          )}
        </div>

        {/* Right Panel: Key Terms or Chat */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <Tabs defaultValue="terms" className="flex flex-col h-full">
            <TabsList className="mx-4 mt-4">
              <TabsTrigger value="terms">Key Terms</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="terms" className="flex-1 overflow-hidden m-0">
              <KeyTermsPanel
                contractId={contract.id}
                terms={contract.key_terms}
              />
            </TabsContent>

            <TabsContent value="chat" className="flex-1 overflow-hidden m-0">
              <ChatInterface
                contractId={contract.id}
                onPageClick={(page) => {
                  // TODO: Scroll PDF to page
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Disclaimer */}
      <Disclaimer />
    </div>
  )
}
```

---

### `src/components/contracts/key-terms-panel.tsx`

```typescript
'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { KeyTermRow } from './key-term-row'

interface KeyTerm {
  id: string
  term_name: string
  value: string | null
  page_number: number | null
  confidence_score: number
  source_sentence: string | null
  is_manual: boolean
  is_edited: boolean
  original_value: string | null
}

interface KeyTermsPanelProps {
  contractId: string
  terms: KeyTerm[]
}

export function KeyTermsPanel({ contractId, terms }: KeyTermsPanelProps) {
  // Sort: custom terms first, then by confidence desc
  const sortedTerms = [...terms].sort((a, b) => {
    if (a.is_manual !== b.is_manual) {
      return a.is_manual ? -1 : 1
    }
    return (b.confidence_score || 0) - (a.confidence_score || 0)
  })

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {sortedTerms.map((term) => (
          <KeyTermRow
            key={term.id}
            contractId={contractId}
            term={term}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
```

---

### `src/components/contracts/key-term-row.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfidenceBadge } from './confidence-badge'
import { SourceSentence } from './source-sentence'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Pencil, Check, X, AlertTriangle } from 'lucide-react'

interface KeyTerm {
  id: string
  term_name: string
  value: string | null
  page_number: number | null
  confidence_score: number
  source_sentence: string | null
  is_manual: boolean
  is_edited: boolean
  original_value: string | null
}

interface KeyTermRowProps {
  contractId: string
  term: KeyTerm
}

export function KeyTermRow({ contractId, term }: KeyTermRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(term.value || '')
  const [showSource, setShowSource] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (newValue: string) => {
      const res = await fetch(
        `/api/contracts/${contractId}/terms/${term.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: newValue }),
        }
      )
      if (!res.ok) throw new Error('Failed to update term')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
      setIsEditing(false)
    },
  })

  const handleSave = () => {
    mutation.mutate(editValue)
  }

  const handleCancel = () => {
    setEditValue(term.value || '')
    setIsEditing(false)
  }

  const isLowConfidence = term.confidence_score < 0.5

  return (
    <Card className={isLowConfidence ? 'border-yellow-300' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">
              {term.term_name}
            </CardTitle>
            {term.is_manual && (
              <Badge variant="outline" className="text-xs">
                Custom
              </Badge>
            )}
            {term.is_edited && (
              <Badge variant="secondary" className="text-xs">
                Edited
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLowConfidence && (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
            <ConfidenceBadge score={term.confidence_score} />
            {term.page_number && (
              <span className="text-xs text-muted-foreground">
                Page {term.page_number}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="flex gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={mutation.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={mutation.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm">
              {term.value || (
                <span className="text-muted-foreground italic">
                  Not found in document
                </span>
              )}
            </p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
              {term.source_sentence && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSource(!showSource)}
                >
                  Why?
                </Button>
              )}
            </div>
          </div>
        )}

        {showSource && term.source_sentence && (
          <SourceSentence
            sentence={term.source_sentence}
            originalValue={term.original_value}
            isEdited={term.is_edited}
          />
        )}
      </CardContent>
    </Card>
  )
}
```

---

### `src/components/contracts/confidence-badge.tsx`

```typescript
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ConfidenceBadgeProps {
  score: number
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const percentage = Math.round(score * 100)

  const colorClass =
    score >= 0.8 ? 'bg-green-100 text-green-800' :
    score >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
    'bg-red-100 text-red-800'

  return (
    <Badge className={cn('text-xs', colorClass)}>
      {percentage}%
    </Badge>
  )
}
```

---

### `src/components/contracts/pdf-viewer.tsx`

```typescript
'use client'

import { useState, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

// Set worker path
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface PdfViewerProps {
  url: string
  initialPage?: number
}

export function PdfViewer({ url, initialPage = 1 }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(initialPage)
  const [scale, setScale] = useState(1.0)
  const containerRef = useRef<HTMLDivElement>(null)

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  const goToPage = (page: number) => {
    if (page >= 1 && page <= (numPages || 1)) {
      setPageNumber(page)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => goToPage(pageNumber - 1)}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {pageNumber} of {numPages || '...'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => goToPage(pageNumber + 1)}
            disabled={pageNumber >= (numPages || 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setScale(s => Math.min(2.0, s + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div ref={containerRef} className="flex-1 overflow-auto p-4">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div>Loading PDF...</div>}
          error={<div>Failed to load PDF</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  )
}
```

---

### `src/app/api/contracts/[id]/terms/[termId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const updateTermSchema = z.object({
  value: z.string(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; termId: string } }
) {
  try {
    const supabase = await createClient()
    const { id: contractId, termId } = params

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse body
    const body = await request.json()
    const { value } = updateTermSchema.parse(body)

    // Fetch term with contract
    const { data: term, error: fetchError } = await supabase
      .from('key_terms')
      .select(`
        *,
        contracts!inner (user_id)
      `)
      .eq('id', termId)
      .eq('contract_id', contractId)
      .single()

    if (fetchError || !term) {
      return NextResponse.json({ error: 'Term not found' }, { status: 404 })
    }

    // Verify ownership
    if (term.contracts.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Preserve original value on first edit
    const updates: Record<string, any> = {
      value,
      is_edited: true,
    }

    if (!term.is_edited && term.value !== null) {
      updates.original_value = term.value
    }

    // Update term
    const { data: updatedTerm, error: updateError } = await supabase
      .from('key_terms')
      .update(updates)
      .eq('id', termId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ term: updatedTerm })

  } catch (error) {
    console.error('Update term error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Acceptance Criteria

- [ ] Two-panel layout renders correctly
- [ ] PDF viewer displays when file available
- [ ] Text viewer fallback when no PDF
- [ ] All key terms displayed in right panel
- [ ] Confidence badges color-coded (green/amber/red)
- [ ] Low confidence terms show warning icon
- [ ] Click "Edit" enables inline editing
- [ ] Save updates term in database
- [ ] Original value preserved on first edit
- [ ] "Edited" badge appears after edit
- [ ] Click "Why?" shows source sentence
- [ ] Custom terms show "Custom" badge
- [ ] Tab switching between Key Terms and Chat
- [ ] Page navigation works in PDF viewer
- [ ] Zoom controls work in PDF viewer
- [ ] "Not legal advice" disclaimer shown
- [ ] Back button returns to dashboard
