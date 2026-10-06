import { KeyTerm } from './key-term'

export type ContractType = 'nda' | 'msa'

export type ContractStatus = 'pending' | 'processing' | 'completed' | 'error'

export interface Contract {
  id: string
  user_id: string
  name: string
  type: ContractType
  status: ContractStatus
  contract_text: string | null
  file_path: string | null
  file_url?: string | null
  page_count: number | null
  created_at: string
  updated_at: string
}

export interface ContractWithTerms extends Contract {
  terms: KeyTerm[]
}

export interface CreateContractInput {
  name: string
  type: ContractType
  customTerms?: string[]
}

export interface ContractStats {
  total: number
  nda_count: number
  msa_count: number
}
