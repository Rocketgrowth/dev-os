/**
 * Token and Usage Limits
 *
 * Configurable constants and validators for file size, page count,
 * message length, and chat history limits.
 */

// File upload limits
export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10)
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

// Page count limits
export const MAX_PAGE_COUNT = parseInt(process.env.MAX_PAGE_COUNT || '200', 10)

// Message limits
export const MAX_MESSAGE_LENGTH = 5000

// Chat history limit (number of messages to send to model)
export const MAX_CHAT_HISTORY = parseInt(process.env.MAX_CHAT_HISTORY || '100', 10)

// Minimum words for valid PDF extraction
export const MIN_EXTRACTED_WORDS = parseInt(process.env.MIN_EXTRACTED_WORDS || '100', 10)

// Custom terms limit
export const MAX_CUSTOM_TERMS = 5

export interface ValidationResult {
  valid: boolean
  error?: string
  code?: string
}

/**
 * Validates file size against the configured limit
 */
export function validateFileSize(sizeBytes: number): ValidationResult {
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE_MB} MB limit.`,
      code: 'FILE_TOO_LARGE',
    }
  }
  return { valid: true }
}

/**
 * Validates page count against the configured limit
 */
export function validatePageCount(pageCount: number): ValidationResult {
  if (pageCount > MAX_PAGE_COUNT) {
    return {
      valid: false,
      error: `Document exceeds ${MAX_PAGE_COUNT} page limit.`,
      code: 'TOO_MANY_PAGES',
    }
  }
  return { valid: true }
}

/**
 * Validates message length against the configured limit
 */
export function validateMessageLength(message: string): ValidationResult {
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message exceeds ${MAX_MESSAGE_LENGTH} character limit.`,
      code: 'MESSAGE_TOO_LONG',
    }
  }
  return { valid: true }
}

/**
 * Validates word count for PDF extraction
 */
export function validateExtractedWords(wordCount: number): ValidationResult {
  if (wordCount < MIN_EXTRACTED_WORDS) {
    return {
      valid: false,
      error: 'Unable to extract text from document. Scanned documents are not supported.',
      code: 'INSUFFICIENT_TEXT',
    }
  }
  return { valid: true }
}

/**
 * Validates custom terms count
 */
export function validateCustomTermsCount(count: number): ValidationResult {
  if (count > MAX_CUSTOM_TERMS) {
    return {
      valid: false,
      error: `Maximum ${MAX_CUSTOM_TERMS} custom terms allowed.`,
      code: 'TOO_MANY_TERMS',
    }
  }
  return { valid: true }
}

/**
 * Truncates chat history to the configured limit
 * Keeps the most recent messages
 */
export function truncateChatHistory<T>(messages: T[]): T[] {
  if (messages.length <= MAX_CHAT_HISTORY) {
    return messages
  }
  return messages.slice(-MAX_CHAT_HISTORY)
}

/**
 * Creates a validation error response
 */
export function createValidationErrorResponse(result: ValidationResult): Response {
  return new Response(
    JSON.stringify({
      error: result.error,
      code: result.code || 'VALIDATION_ERROR',
    }),
    {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
