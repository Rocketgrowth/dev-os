import { z } from 'zod'

// Auth schemas
export const signUpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

// Contract schemas
export const contractTypeSchema = z.enum(['nda', 'msa'])

export const uploadContractSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: contractTypeSchema,
  customTerms: z.array(z.string()).max(5).optional(),
})

export const updateKeyTermSchema = z.object({
  value: z.string(),
})

// Chat schemas
export const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000, 'Message must be 5000 characters or less'),
})

// Feedback schemas
export const feedbackRatingSchema = z.union([z.literal(-1), z.literal(1)])

export const createFeedbackSchema = z.object({
  contract_id: z.string().uuid(),
  rating: feedbackRatingSchema,
  comment: z.string().max(1000).optional(),
})

// API response schemas
export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
})

// Key term extraction response schema (from OpenAI)
export const extractedTermSchema = z.object({
  term_name: z.string(),
  value: z.string().nullable(),
  page_number: z.number().int().positive().nullable(),
  confidence_score: z.number().min(0).max(1),
  source_sentence: z.string().nullable(),
})

export const extractionResponseSchema = z.object({
  terms: z.array(extractedTermSchema),
})

// Type exports
export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type UploadContractInput = z.infer<typeof uploadContractSchema>
export type UpdateKeyTermInput = z.infer<typeof updateKeyTermSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>
export type ExtractedTerm = z.infer<typeof extractedTermSchema>
export type ExtractionResponse = z.infer<typeof extractionResponseSchema>
