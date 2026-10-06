// File upload limits
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_FILE_SIZE_MB = 10
export const MAX_PAGE_COUNT = 20
export const MAX_TOKEN_COUNT = 15000
export const MIN_EXTRACTED_WORDS = 100 // Below this, assume scanned PDF

// Custom terms limits
export const MAX_CUSTOM_TERMS = 5

// Chat limits
export const MAX_CHAT_MESSAGES = 200
export const MAX_CHAT_MESSAGE_LENGTH = 2000

// API rate limits
export const AI_REQUESTS_PER_MINUTE = 10

// Signed URL expiry
export const SIGNED_URL_EXPIRY_SECONDS = 3600 // 1 hour

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 100
