export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

export interface AuthResponse {
  user: {
    id: string
    email: string
  }
}

export interface UploadResponse {
  contract: {
    id: string
    name: string
    type: string
    status: string
    page_count: number
    created_at: string
  }
}

export interface ProcessResponse {
  contract: {
    id: string
    status: string
  }
  terms: Array<{
    id: string
    term_name: string
    value: string | null
    page_number: number | null
    confidence_score: number | null
    source_sentence: string | null
    is_manual: boolean
  }>
}
