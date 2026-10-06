import { createClient } from '@/lib/supabase/server'
import { extractText, countWords } from '@/lib/pdf/extract-text'
import {
  requireAuth,
  isAuthError,
  checkRateLimit,
  createRateLimitResponse,
  validateFileUpload,
  createFileValidationErrorResponse,
  validatePageCount,
  validateExtractedWords,
  validateCustomTermsCount,
  MAX_FILE_SIZE_BYTES,
  MAX_CUSTOM_TERMS,
} from '@/lib/security'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Authenticate
    const auth = await requireAuth()
    if (isAuthError(auth)) {
      return auth.response
    }
    const { user, supabase } = auth

    // Check rate limit
    const rateLimitResult = await checkRateLimit(user.id, 'upload')
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const name = (formData.get('name') as string) || undefined
    const type = formData.get('type') as string
    const customTermsRaw = formData.get('customTerms') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', code: 'NO_FILE' },
        { status: 400 }
      )
    }

    // Validate file (extension, MIME type, magic bytes, size)
    const fileValidation = await validateFileUpload(file, {
      maxSizeBytes: MAX_FILE_SIZE_BYTES,
    })
    if (!fileValidation.valid) {
      return createFileValidationErrorResponse(fileValidation)
    }

    // Validate contract type
    if (!type || !['nda', 'msa'].includes(type)) {
      return NextResponse.json(
        { error: "Invalid contract type. Must be 'nda' or 'msa'.", code: 'INVALID_TYPE' },
        { status: 422 }
      )
    }

    // Parse and validate custom terms
    let customTerms: string[] = []
    if (customTermsRaw) {
      try {
        customTerms = JSON.parse(customTermsRaw)
        if (!Array.isArray(customTerms)) {
          customTerms = []
        }
      } catch {
        customTerms = []
      }
    }

    const termsValidation = validateCustomTermsCount(customTerms.length)
    if (!termsValidation.valid) {
      return NextResponse.json(
        { error: termsValidation.error, code: termsValidation.code },
        { status: 422 }
      )
    }

    // Extract text from PDF
    const buffer = Buffer.from(await file.arrayBuffer())
    let extractedText: string
    let pageCount: number

    try {
      const result = await extractText(buffer)
      extractedText = result.text
      pageCount = result.pageCount
    } catch (error) {
      console.error('PDF extraction error:', error)
      return NextResponse.json(
        { error: 'Failed to extract text from document.', code: 'EXTRACTION_FAILED' },
        { status: 400 }
      )
    }

    // Validate page count
    const pageValidation = validatePageCount(pageCount)
    if (!pageValidation.valid) {
      return NextResponse.json(
        { error: pageValidation.error, code: pageValidation.code },
        { status: 422 }
      )
    }

    // Validate extracted text
    const wordCount = countWords(extractedText)
    const textValidation = validateExtractedWords(wordCount)
    if (!textValidation.valid) {
      return NextResponse.json(
        { error: textValidation.error, code: textValidation.code },
        { status: 400 }
      )
    }

    // Store file and create contract record
    const contractId = crypto.randomUUID()
    const fileName = name || file.name
    const storagePath = `${user.id}/${contractId}/${file.name}`

    let filePath: string | null = null
    try {
      const { error: storageError } = await supabase.storage
        .from('contracts')
        .upload(storagePath, buffer, {
          contentType: file.type,
          upsert: false,
        })

      if (!storageError) {
        filePath = storagePath
      }
    } catch (e) {
      console.error('Storage upload failed:', e)
      // Continue without file storage - text extraction succeeded
    }

    // Create contract record
    const { data: contract, error: dbError } = await supabase
      .from('contracts')
      .insert({
        id: contractId,
        user_id: user.id,
        name: fileName,
        type,
        status: 'pending',
        contract_text: extractedText,
        file_path: filePath,
        page_count: pageCount,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create contract.', code: 'DATABASE_ERROR' },
        { status: 500 }
      )
    }

    // Save custom terms
    if (customTerms.length > 0) {
      const { error: customTermsError } = await supabase
        .from('custom_key_terms')
        .insert(
          customTerms.map((termName) => ({
            contract_id: contractId,
            term_name: termName,
          }))
        )

      if (customTermsError) {
        console.error('Custom terms error:', customTermsError)
      }
    }

    return NextResponse.json(
      {
        contract: {
          id: contract.id,
          name: contract.name,
          type: contract.type,
          status: contract.status,
          page_count: contract.page_count,
          created_at: contract.created_at,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
