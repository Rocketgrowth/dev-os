# PDF Upload & Text Extraction Specification

## Overview

Users upload PDF contracts via drag-and-drop or file picker. The system validates the file, extracts text with page markers, stores the PDF in Supabase Storage, and creates a contract record in the database.

---

## User Flow

```
1. User navigates to /upload
2. User selects contract type (NDA or MSA) from dropdown
3. User drags/drops or file-picks a PDF
4. Frontend validates file locally:
   - File type: PDF only (application/pdf)
   - File size: ≤ 10 MB
5. User optionally adds up to 5 custom terms
6. User clicks "Process Contract"
7. Frontend shows progress indicator (Step 1: Extracting text)
8. Frontend calls POST /api/contracts/upload
9. Backend:
   - Validates file again (type, size)
   - Extracts text using pdf-parse with [PAGE N] markers
   - Validates page count ≤ 20
   - Validates extracted text ≥ 100 words (rejects scanned PDFs)
   - Stores PDF in Supabase Storage
   - Creates contract record in database
10. On success: return contract_id, proceed to extraction
11. On error: display specific error message
```

---

## API Route

### POST /api/contracts/upload

**File:** `app/api/contracts/upload/route.ts`

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | PDF file (max 10MB) |
| name | string | No | Contract name (defaults to filename) |
| type | string | Yes | "nda" or "msa" |
| customTerms | string[] | No | Up to 5 custom term names |

**Success Response (201):**
```json
{
  "contract": {
    "id": "uuid",
    "name": "Vendor NDA.pdf",
    "type": "nda",
    "status": "pending",
    "page_count": 12,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses:**

| Status | Error | Condition |
|--------|-------|-----------|
| 400 | "Invalid file type. Only PDF files are allowed." | Not application/pdf |
| 400 | "File size exceeds 10 MB limit." | File > 10MB |
| 400 | "PDF exceeds 20 page limit." | Page count > 20 |
| 400 | "Unable to extract text from PDF. Scanned documents are not supported." | < 100 words extracted |
| 400 | "Invalid contract type. Must be 'nda' or 'msa'." | Invalid type |
| 400 | "Maximum 5 custom terms allowed." | > 5 custom terms |
| 401 | "Unauthorized" | No valid session |
| 500 | "Failed to upload file to storage." | Storage error (non-blocking) |
| 500 | "Failed to create contract." | Database error |

**Implementation:**
```typescript
import { createClient } from '@/lib/supabase/server'
import { extractText } from '@/lib/pdf/extract-text'
import { uploadContractSchema } from '@/lib/validation/schemas'
import { MAX_FILE_SIZE, MAX_PDF_PAGES, MIN_EXTRACTED_WORDS } from '@/constants/limits'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const name = formData.get('name') as string || file.name
  const type = formData.get('type') as string
  const customTermsRaw = formData.get('customTerms') as string
  const customTerms = customTermsRaw ? JSON.parse(customTermsRaw) : []

  // Validate file type
  if (file.type !== 'application/pdf') {
    return Response.json(
      { error: 'Invalid file type. Only PDF files are allowed.' },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return Response.json(
      { error: 'File size exceeds 10 MB limit.' },
      { status: 400 }
    )
  }

  // Validate contract type
  if (!['nda', 'msa'].includes(type)) {
    return Response.json(
      { error: "Invalid contract type. Must be 'nda' or 'msa'." },
      { status: 400 }
    )
  }

  // Validate custom terms count
  if (customTerms.length > 5) {
    return Response.json(
      { error: 'Maximum 5 custom terms allowed.' },
      { status: 400 }
    )
  }

  // Extract text from PDF
  const buffer = Buffer.from(await file.arrayBuffer())
  const { text, pageCount } = await extractText(buffer)

  // Validate page count
  if (pageCount > MAX_PDF_PAGES) {
    return Response.json(
      { error: 'PDF exceeds 20 page limit.' },
      { status: 400 }
    )
  }

  // Validate text extraction (detect scanned PDFs)
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length
  if (wordCount < MIN_EXTRACTED_WORDS) {
    return Response.json(
      { error: 'Unable to extract text from PDF. Scanned documents are not supported.' },
      { status: 400 }
    )
  }

  // Generate contract ID
  const contractId = crypto.randomUUID()

  // Upload to Supabase Storage (non-blocking)
  let filePath: string | null = null
  try {
    const storagePath = `${user.id}/${contractId}/${file.name}`
    const { error: storageError } = await supabase.storage
      .from('contracts')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (!storageError) {
      filePath = storagePath
    }
  } catch (e) {
    // Storage upload failed, continue without file_path
    console.error('Storage upload failed:', e)
  }

  // Create contract record
  const { data: contract, error: dbError } = await supabase
    .from('contracts')
    .insert({
      id: contractId,
      user_id: user.id,
      name,
      type,
      status: 'pending',
      contract_text: text,
      file_path: filePath,
      page_count: pageCount,
    })
    .select()
    .single()

  if (dbError) {
    return Response.json(
      { error: 'Failed to create contract.' },
      { status: 500 }
    )
  }

  // Create custom key terms records
  if (customTerms.length > 0) {
    await supabase.from('custom_key_terms').insert(
      customTerms.map((term: string) => ({
        contract_id: contractId,
        term_name: term,
      }))
    )
  }

  return Response.json({ contract }, { status: 201 })
}
```

---

## PDF Text Extraction

**File:** `lib/pdf/extract-text.ts`

**Purpose:** Extract text from PDF with page markers for attribution

**Returns:**
```typescript
{
  text: string    // Full text with [PAGE N] markers
  pageCount: number
}
```

**Implementation:**
```typescript
import pdf from 'pdf-parse'

interface ExtractResult {
  text: string
  pageCount: number
}

export async function extractText(buffer: Buffer): Promise<ExtractResult> {
  const data = await pdf(buffer, {
    // Custom page render function to add page markers
    pagerender: async function(pageData) {
      const textContent = await pageData.getTextContent()
      const strings = textContent.items.map((item: any) => item.str)
      return strings.join(' ')
    }
  })

  // Add page markers
  const pages = data.text.split(/\f/) // Form feed character separates pages
  const textWithMarkers = pages
    .map((pageText, index) => `[PAGE ${index + 1}]\n${pageText.trim()}`)
    .join('\n\n')

  return {
    text: textWithMarkers,
    pageCount: data.numpages,
  }
}
```

---

## Frontend Components

### UploadDropzone Component

**File:** `components/contracts/upload-dropzone.tsx`

**Props:**
```typescript
interface UploadDropzoneProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
}
```

**Features:**
- react-dropzone for drag-and-drop
- Click to open file picker
- File type restriction (accept: application/pdf)
- Visual feedback for drag states
- File preview after selection

**Implementation:**
```typescript
'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export function UploadDropzone({ onFileSelect, disabled }: UploadDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0])
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled,
  })

  const selectedFile = acceptedFiles[0]

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <input {...getInputProps()} />
      {selectedFile ? (
        <div className="flex items-center justify-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div className="text-left">
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>
      ) : (
        <>
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-1">
            {isDragActive ? 'Drop your PDF here' : 'Drag & drop your PDF'}
          </p>
          <p className="text-sm text-muted-foreground">
            or click to browse (max 10 MB, 20 pages)
          </p>
        </>
      )}
    </div>
  )
}
```

### ContractTypeSelector Component

**File:** `components/contracts/contract-type-selector.tsx`

**Props:**
```typescript
interface ContractTypeSelectorProps {
  value: 'nda' | 'msa' | null
  onChange: (value: 'nda' | 'msa') => void
}
```

**Features:**
- shadcn/ui Select component
- Clear labels for each type
- Accessible keyboard navigation

### CustomTermInput Component

**File:** `components/contracts/custom-term-input.tsx`

**Props:**
```typescript
interface CustomTermInputProps {
  terms: string[]
  onChange: (terms: string[]) => void
  maxTerms?: number // default: 5
}
```

**Features:**
- Add term input with button
- List of added terms with remove button
- Counter showing X/5 custom terms
- Validation: non-empty, no duplicates

---

## Upload Page

**File:** `app/(dashboard)/upload/page.tsx`

**State:**
```typescript
const [file, setFile] = useState<File | null>(null)
const [contractType, setContractType] = useState<'nda' | 'msa' | null>(null)
const [customTerms, setCustomTerms] = useState<string[]>([])
const [isUploading, setIsUploading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

**Flow:**
1. Select contract type (required)
2. Upload file (required)
3. Optionally add custom terms
4. Show preview of standard terms for selected type
5. "Process Contract" button (disabled until type + file selected)
6. On submit: upload, then redirect to processing

---

## Hooks

### useUpload Hook

**File:** `hooks/use-upload.ts`

**Returns:**
```typescript
{
  upload: (file: File, type: 'nda' | 'msa', customTerms?: string[]) => Promise<Contract>
  isUploading: boolean
  progress: number
  error: string | null
}
```

---

## Constants

### File Limits

**File:** `constants/limits.ts`

```typescript
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_PDF_PAGES = 20
export const MIN_EXTRACTED_WORDS = 100
export const MAX_CUSTOM_TERMS = 5
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Non-PDF file uploaded | Reject with "Invalid file type" |
| File > 10 MB | Reject with "File size exceeds limit" |
| PDF > 20 pages | Reject with "PDF exceeds page limit" |
| Scanned PDF (image-based) | Reject with "Unable to extract text" |
| Empty PDF | Reject with "Unable to extract text" |
| Password-protected PDF | pdf-parse throws error, display generic error |
| Storage upload fails | Continue without file_path, text viewer fallback |
| Network error during upload | Display toast with retry option |
| Duplicate custom term | Prevent addition, show validation message |

---

## Acceptance Criteria

- [ ] Drag-and-drop or file picker upload works
- [ ] File validated: PDF only, ≤ 10 MB, ≤ 20 pages
- [ ] Text extracted with [PAGE N] markers
- [ ] Scanned PDFs rejected with clear error (< 100 words extracted)
- [ ] Contract stored in database with status "pending"
- [ ] PDF optionally stored in Supabase Storage
- [ ] Custom terms (up to 5) can be added before processing
- [ ] Clear error messages for all validation failures
