export interface KeyTerm {
  id: string
  contract_id: string
  term_name: string
  value: string | null
  page_number: number | null
  confidence_score: number | null
  source_sentence: string | null
  is_manual: boolean
  is_edited: boolean
  original_value: string | null
  created_at: string
}

export interface UpdateKeyTermInput {
  value: string
}

export interface CustomKeyTerm {
  id: string
  contract_id: string
  term_name: string
  created_at: string
}
