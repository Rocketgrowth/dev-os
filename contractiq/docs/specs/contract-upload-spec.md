# Contract Upload Specification

## Overview

Users upload PDF contracts for analysis. The system validates the file, extracts text with page markers, stores the PDF in Supabase Storage, and creates a contract record ready for AI processing.

---

## User Flow

```
1. User clicks "Review Contract" on Dashboard
2. Navigate to /upload
3. User selects contract type (NDA or MSA) from dropdown
4. User drags/drops or file-picks a PDF
5. Frontend validates: PDF format, ≤10MB, file extension
6. User optionally adds custom terms (up to 5) via "+ Add Key Term"
7. User clicks "Process Contract"
8. Frontend shows progress indicator (Step 1: Extracting text...)
9. POST /api/contracts/upload with file + metadata
10. Backend extracts text with pdf-parse, adds [PAGE N] markers
11. Backend uploads PDF to Supabase Storage
12. Backend creates contract record in database
13. Backend returns contract_id
14. Frontend proceeds to AI processing step
```

---

## Validation Rules

| Rule | Value | Error Message |
|------|-------|---------------|
| File type | `application/pdf` | "Only PDF files are accepted" |
| File extension | `.pdf` | "File must have .pdf extension" |
| File size | ≤ 10 MB | "File size must be 10 MB or less" |
| Page count | ≤ 20 pages | "Contract must be 20 pages or less" |
| Extracted text | ≥ 100 words | "This appears to be a scanned PDF. Please upload a text-based PDF" |
| Custom terms | ≤ 5 terms | "You can add up to 5 custom terms" |
| Custom term name | 1-100 characters | "Term name must be 1-100 characters" |

---

## Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/(dashboard)/upload/page.tsx` | Upload wizard page |
| `src/components/contracts/upload-dropzone.tsx` | Drag-and-drop upload zone |
| `src/components/contracts/contract-type-selector.tsx` | NDA/MSA dropdown |
| `src/components/contracts/custom-term-input.tsx` | Add custom term input |
| `src/components/contracts/processing-progress.tsx` | 3-step progress indicator |
| `src/app/api/contracts/upload/route.ts` | Upload API endpoint |
| `src/lib/pdf/extract-text.ts` | pdf-parse wrapper with page markers |
| `src/lib/contracts/upload.ts` | Upload service logic |
| `src/lib/validation/upload-schemas.ts` | Zod validation schemas |
| `src/hooks/use-upload.ts` | Upload mutation hook |

---

### `src/lib/pdf/extract-text.ts`

```typescript
import pdf from 'pdf-parse'

interface ExtractedText {
  text: string
  pageCount: number
  wordCount: number
}

export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractedText> {
  const data = await pdf(buffer)

  // Split by page and add markers
  const pages = data.text.split(/\f/) // Form feed character separates pages
  const markedText = pages
    .map((pageText, index) => `[PAGE ${index + 1}]\n${pageText.trim()}`)
    .join('\n\n')

  const wordCount = markedText
    .replace(/\[PAGE \d+\]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length

  return {
    text: markedText,
    pageCount: data.numpages,
    wordCount,
  }
}
```

---

### `src/lib/validation/upload-schemas.ts`

```typescript
import { z } from 'zod'

export const contractTypeSchema = z.enum(['nda', 'msa'])

export const customTermSchema = z.object({
  term_name: z.string().min(1).max(100),
})

export const uploadRequestSchema = z.object({
  name: z.string().optional(),
  type: contractTypeSchema,
  customTerms: z.array(customTermSchema).max(5).optional(),
})

export type ContractType = z.infer<typeof contractTypeSchema>
export type UploadRequest = z.infer<typeof uploadRequestSchema>
```

---

### `src/app/api/contracts/upload/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractTextFromPdf } from '@/lib/pdf/extract-text'
import { uploadRequestSchema } from '@/lib/validation/upload-schemas'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_PAGE_COUNT = 20
const MIN_WORD_COUNT = 100

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null
    const type = formData.get('type') as string
    const customTermsJson = formData.get('customTerms') as string | null

    // Validate file exists
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size must be 10 MB or less' }, { status: 400 })
    }

    // Validate request body
    const customTerms = customTermsJson ? JSON.parse(customTermsJson) : []
    const validatedData = uploadRequestSchema.parse({
      name: name || file.name.replace('.pdf', ''),
      type,
      customTerms,
    })

    // Extract text from PDF
    const buffer = Buffer.from(await file.arrayBuffer())
    const extracted = await extractTextFromPdf(buffer)

    // Validate page count
    if (extracted.pageCount > MAX_PAGE_COUNT) {
      return NextResponse.json(
        { error: `Contract must be ${MAX_PAGE_COUNT} pages or less` },
        { status: 400 }
      )
    }

    // Validate word count (reject scanned PDFs)
    if (extracted.wordCount < MIN_WORD_COUNT) {
      return NextResponse.json(
        { error: 'This appears to be a scanned PDF. Please upload a text-based PDF' },
        { status: 400 }
      )
    }

    // Create contract record
    const { data: contract, error: insertError } = await supabase
      .from('contracts')
      .insert({
        user_id: user.id,
        name: validatedData.name,
        type: validatedData.type,
        status: 'pending',
        contract_text: extracted.text,
        page_count: extracted.pageCount,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create contract:', insertError)
      return NextResponse.json({ error: 'Failed to create contract' }, { status: 500 })
    }

    // Upload PDF to storage (non-blocking failure)
    const storagePath = `${user.id}/${contract.id}/${file.name}`
    const { error: storageError } = await supabase.storage
      .from('contracts')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (!storageError) {
      // Update contract with file path
      await supabase
        .from('contracts')
        .update({ file_path: storagePath })
        .eq('id', contract.id)
    } else {
      console.warn('Storage upload failed (continuing without file):', storageError)
    }

    // Insert custom terms if provided
    if (validatedData.customTerms && validatedData.customTerms.length > 0) {
      const customTermRecords = validatedData.customTerms.map((term) => ({
        contract_id: contract.id,
        term_name: term.term_name,
      }))

      await supabase.from('custom_key_terms').insert(customTermRecords)
    }

    return NextResponse.json({
      contract: {
        id: contract.id,
        name: contract.name,
        type: contract.type,
        status: contract.status,
        page_count: extracted.pageCount,
        created_at: contract.created_at,
      },
    }, { status: 201 })

  } catch (error) {
    console.error('Upload error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

### `src/components/contracts/upload-dropzone.tsx`

```typescript
'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, AlertCircle } from 'lucide-react'

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void
  error?: string
}

export function UploadDropzone({ onFileSelect, error }: UploadDropzoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setSelectedFile(file)
      onFileSelect(file)
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024, // 10 MB
    maxFiles: 1,
  })

  const rejectionError = fileRejections[0]?.errors[0]?.message

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-colors duration-200
        ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
        ${error || rejectionError ? 'border-destructive' : ''}
      `}
    >
      <input {...getInputProps()} />

      {selectedFile ? (
        <div className="flex flex-col items-center gap-2">
          <FileText className="h-12 w-12 text-primary" />
          <p className="font-medium">{selectedFile.name}</p>
          <p className="text-sm text-muted-foreground">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <p className="text-sm text-muted-foreground">
            Click or drag to replace
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-12 w-12 text-muted-foreground" />
          <p className="font-medium">
            {isDragActive ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
          </p>
          <p className="text-sm text-muted-foreground">
            or click to browse (max 10 MB, 20 pages)
          </p>
        </div>
      )}

      {(error || rejectionError) && (
        <div className="flex items-center justify-center gap-2 mt-4 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error || rejectionError}</p>
        </div>
      )}
    </div>
  )
}
```

---

## Storage Path Convention

```
contracts/{user_id}/{contract_id}/{original_filename}.pdf
```

Example:
```
contracts/550e8400-e29b-41d4-a716-446655440000/7c9e6679-7425-40de-944b-e07fc1f90ae7/vendor-nda-acme.pdf
```

---

## Acceptance Criteria

- [ ] User can drag and drop a PDF file
- [ ] User can click to browse and select a PDF file
- [ ] Non-PDF files are rejected with clear error
- [ ] Files over 10 MB are rejected with clear error
- [ ] PDFs over 20 pages are rejected with clear error
- [ ] Scanned PDFs (< 100 words) are rejected with clear error
- [ ] User can select contract type (NDA or MSA)
- [ ] User can add up to 5 custom terms
- [ ] User cannot add more than 5 custom terms
- [ ] Progress indicator shows during upload/extraction
- [ ] Contract record is created in database
- [ ] PDF is uploaded to Supabase Storage
- [ ] Custom terms are stored in custom_key_terms table
- [ ] Upload continues even if storage upload fails
- [ ] User is redirected to processing step on success
