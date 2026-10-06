export type FeedbackRating = -1 | 1

export interface UserFeedback {
  id: string
  user_id: string
  contract_id: string
  rating: FeedbackRating
  comment: string | null
  created_at: string
}

export interface CreateFeedbackInput {
  contract_id: string
  rating: FeedbackRating
  comment?: string
}
