/**
 * Input Validation
 *
 * File upload security and re-exports of all Zod schemas.
 */

import { NextResponse } from 'next/server'

// Re-export all Zod schemas from validation
export {
  signUpSchema,
  signInSchema,
  contractTypeSchema,
  uploadContractSchema,
  updateKeyTermSchema,
  sendMessageSchema,
  feedbackRatingSchema,
  createFeedbackSchema,
  apiErrorSchema,
  extractedTermSchema,
  extractionResponseSchema,
  type SignUpInput,
  type SignInInput,
  type UploadContractInput,
  type UpdateKeyTermInput,
  type SendMessageInput,
  type CreateFeedbackInput,
  type ExtractedTerm,
  type ExtractionResponse,
} from '@/lib/validation/schemas'

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.pdf', '.docx'] as const
type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number]

// Blocked dangerous extensions
const BLOCKED_EXTENSIONS = [
  '.exe',
  '.js',
  '.mjs',
  '.cjs',
  '.php',
  '.zip',
  '.sh',
  '.bat',
  '.cmd',
  '.py',
  '.rb',
  '.ps1',
  '.vbs',
  '.jar',
  '.msi',
  '.dll',
  '.so',
] as const

// Allowed MIME types mapped to extensions
const ALLOWED_MIME_TYPES: Record<AllowedExtension, string[]> = {
  '.pdf': ['application/pdf'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
}

// Magic bytes for file type verification
const FILE_SIGNATURES: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    0x50, 0x4b, 0x03, 0x04, // PK (ZIP archive)
  ],
}

export interface FileValidationResult {
  valid: boolean
  error?: string
  code?: string
}

/**
 * Gets the file extension from a filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filename.slice(lastDot).toLowerCase()
}

/**
 * Validates file extension against blocklist and allowlist
 */
function validateExtension(filename: string): FileValidationResult {
  const extension = getFileExtension(filename)

  if (!extension) {
    return {
      valid: false,
      error: 'File must have an extension.',
      code: 'NO_EXTENSION',
    }
  }

  // Check blocklist first
  if (BLOCKED_EXTENSIONS.includes(extension as (typeof BLOCKED_EXTENSIONS)[number])) {
    return {
      valid: false,
      error: 'This file type is not allowed for security reasons.',
      code: 'BLOCKED_EXTENSION',
    }
  }

  // Check allowlist
  if (!ALLOWED_EXTENSIONS.includes(extension as AllowedExtension)) {
    return {
      valid: false,
      error: `Only ${ALLOWED_EXTENSIONS.join(', ')} files are allowed.`,
      code: 'INVALID_EXTENSION',
    }
  }

  return { valid: true }
}

/**
 * Validates MIME type matches the expected type for the extension
 */
function validateMimeType(
  mimeType: string,
  extension: string
): FileValidationResult {
  const allowedMimes =
    ALLOWED_MIME_TYPES[extension as AllowedExtension] || []

  if (!allowedMimes.includes(mimeType)) {
    return {
      valid: false,
      error: 'File type does not match extension.',
      code: 'MIME_MISMATCH',
    }
  }

  return { valid: true }
}

/**
 * Validates file content magic bytes match the expected type
 */
async function validateMagicBytes(
  file: File,
  mimeType: string
): Promise<FileValidationResult> {
  const expectedSignature = FILE_SIGNATURES[mimeType]

  if (!expectedSignature) {
    // No signature check available for this type
    return { valid: true }
  }

  try {
    const headerBytes = await file.slice(0, 8).arrayBuffer()
    const header = new Uint8Array(headerBytes)

    const signatureMatches = expectedSignature.every(
      (byte, index) => header[index] === byte
    )

    if (!signatureMatches) {
      return {
        valid: false,
        error: 'File content does not match file type.',
        code: 'INVALID_FILE_CONTENT',
      }
    }

    return { valid: true }
  } catch {
    return {
      valid: false,
      error: 'Unable to verify file content.',
      code: 'VERIFICATION_ERROR',
    }
  }
}

/**
 * Validates file size
 */
function validateSize(sizeBytes: number, maxBytes: number): FileValidationResult {
  if (sizeBytes > maxBytes) {
    const maxMB = Math.floor(maxBytes / (1024 * 1024))
    return {
      valid: false,
      error: `File size exceeds ${maxMB} MB limit.`,
      code: 'FILE_TOO_LARGE',
    }
  }

  return { valid: true }
}

export interface ValidateFileUploadOptions {
  maxSizeBytes: number
}

/**
 * Comprehensive file upload validation.
 * Validates in order:
 * 1. Extension (blocklist → allowlist)
 * 2. MIME type (must match extension)
 * 3. Magic bytes (content verification)
 * 4. File size
 *
 * @param file - The uploaded file
 * @param options - Validation options
 * @returns FileValidationResult
 */
export async function validateFileUpload(
  file: File,
  options: ValidateFileUploadOptions
): Promise<FileValidationResult> {
  const { maxSizeBytes } = options

  // 1. Validate extension
  const extensionResult = validateExtension(file.name)
  if (!extensionResult.valid) {
    return extensionResult
  }

  const extension = getFileExtension(file.name)

  // 2. Validate MIME type
  const mimeResult = validateMimeType(file.type, extension)
  if (!mimeResult.valid) {
    return mimeResult
  }

  // 3. Validate magic bytes
  const magicResult = await validateMagicBytes(file, file.type)
  if (!magicResult.valid) {
    return magicResult
  }

  // 4. Validate file size
  const sizeResult = validateSize(file.size, maxSizeBytes)
  if (!sizeResult.valid) {
    return sizeResult
  }

  return { valid: true }
}

/**
 * Creates a validation error response
 */
export function createFileValidationErrorResponse(
  result: FileValidationResult
): NextResponse {
  return NextResponse.json(
    {
      error: result.error,
      code: result.code || 'VALIDATION_ERROR',
    },
    { status: 422 }
  )
}

/**
 * Checks if a string is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

/**
 * Validates a UUID parameter
 */
export function validateUUID(value: string, paramName = 'id'): FileValidationResult {
  if (!isValidUUID(value)) {
    return {
      valid: false,
      error: `Invalid ${paramName} format.`,
      code: 'INVALID_UUID',
    }
  }
  return { valid: true }
}
