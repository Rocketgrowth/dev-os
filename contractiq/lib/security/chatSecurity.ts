import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface OwnershipResult {
  valid: boolean
  error?: NextResponse
}

export interface ContractData {
  id: string
  user_id: string
  status: string
  contract_text: string | null
}

/**
 * Verifies that the authenticated user owns the contract.
 * Returns 404 NOT_FOUND if the contract doesn't exist or user doesn't own it.
 *
 * @param supabase - Supabase client with user session
 * @param contractId - The contract ID to verify
 * @param userId - The authenticated user's ID
 * @returns OwnershipResult with contract data if valid
 */
export async function verifyContractOwnership(
  supabase: SupabaseClient,
  contractId: string,
  userId: string
): Promise<OwnershipResult & { contract?: ContractData }> {
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, user_id, status, contract_text')
    .eq('id', contractId)
    .single()

  if (error || !contract) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Contract not found', code: 'NOT_FOUND' },
        { status: 404 }
      ),
    }
  }

  if (contract.user_id !== userId) {
    // Return 404 instead of 403 to not reveal that the contract exists
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Contract not found', code: 'NOT_FOUND' },
        { status: 404 }
      ),
    }
  }

  return { valid: true, contract }
}

/**
 * Verifies that the user owns the chat session.
 * Chat sessions are linked to contracts, so we verify contract ownership.
 *
 * @param supabase - Supabase client with user session
 * @param sessionId - The chat session ID to verify
 * @param userId - The authenticated user's ID
 * @returns OwnershipResult
 */
export async function verifySessionOwnership(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
): Promise<OwnershipResult> {
  // Get the chat session
  const { data: session, error: sessionError } = await supabase
    .from('chat_sessions')
    .select('id, contract_id')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Chat session not found', code: 'NOT_FOUND' },
        { status: 404 }
      ),
    }
  }

  // Verify the user owns the contract this session belongs to
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('user_id')
    .eq('id', session.contract_id)
    .single()

  if (contractError || !contract || contract.user_id !== userId) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Chat session not found', code: 'NOT_FOUND' },
        { status: 404 }
      ),
    }
  }

  return { valid: true }
}

/**
 * Verifies that the contract is ready for chat (status === 'completed')
 *
 * @param contract - The contract data
 * @returns OwnershipResult
 */
export function verifyContractReadyForChat(
  contract: ContractData
): OwnershipResult {
  if (contract.status !== 'completed') {
    return {
      valid: false,
      error: NextResponse.json(
        {
          error: 'Contract must be processed before chat is available.',
          code: 'CONTRACT_NOT_READY',
        },
        { status: 400 }
      ),
    }
  }

  if (!contract.contract_text) {
    return {
      valid: false,
      error: NextResponse.json(
        {
          error: 'Contract text not available.',
          code: 'NO_CONTRACT_TEXT',
        },
        { status: 400 }
      ),
    }
  }

  return { valid: true }
}

/**
 * Combined verification for chat endpoints.
 * Verifies contract ownership, status, and text availability.
 *
 * @param supabase - Supabase client with user session
 * @param contractId - The contract ID
 * @param userId - The authenticated user's ID
 * @returns OwnershipResult with contract if valid
 */
export async function verifyChatAccess(
  supabase: SupabaseClient,
  contractId: string,
  userId: string
): Promise<OwnershipResult & { contract?: ContractData }> {
  // First verify ownership
  const ownershipResult = await verifyContractOwnership(
    supabase,
    contractId,
    userId
  )

  if (!ownershipResult.valid || !ownershipResult.contract) {
    return ownershipResult
  }

  // Then verify contract is ready for chat
  const readyResult = verifyContractReadyForChat(ownershipResult.contract)

  if (!readyResult.valid) {
    return readyResult
  }

  return { valid: true, contract: ownershipResult.contract }
}
