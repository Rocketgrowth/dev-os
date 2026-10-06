/**
 * Security Module
 *
 * Central export for all security utilities.
 * Import from '@/lib/security' for all security-related functions.
 */

// Authentication
export {
  requireAuth,
  isAuthError,
  type AuthResult,
  type AuthError,
} from './authGuard'

// Rate limiting
export {
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  RATE_LIMITS,
  type RateLimitResult,
  type RateLimitAction,
} from './rateLimiter'

// Prompt injection protection
export {
  sanitizeForLLM,
  createPromptInjectionResponse,
  isLikelyInjection,
  type SanitizationResult,
} from './promptInjectionGuard'

// Token and usage limits
export {
  MAX_FILE_SIZE_MB,
  MAX_FILE_SIZE_BYTES,
  MAX_PAGE_COUNT,
  MAX_MESSAGE_LENGTH,
  MAX_CHAT_HISTORY,
  MIN_EXTRACTED_WORDS,
  MAX_CUSTOM_TERMS,
  validateFileSize,
  validatePageCount,
  validateMessageLength,
  validateExtractedWords,
  validateCustomTermsCount,
  truncateChatHistory,
  createValidationErrorResponse,
  type ValidationResult,
} from './tokenLimiter'

// Chat security
export {
  verifyContractOwnership,
  verifySessionOwnership,
  verifyContractReadyForChat,
  verifyChatAccess,
  type OwnershipResult,
  type ContractData,
} from './chatSecurity'

// Input validation
export {
  validateFileUpload,
  createFileValidationErrorResponse,
  isValidUUID,
  validateUUID,
  type FileValidationResult,
  type ValidateFileUploadOptions,
  // Re-exported Zod schemas
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
} from './inputValidator'
