import { createClient } from '@/lib/supabase/server'
import { callExtractionAPI } from '@/lib/openai/client'
import { buildExtractionPrompt } from '@/lib/openai/prompts/extraction'
import { parseExtractionResponse } from '@/lib/openai/parse-response'
import { STANDARD_TERMS } from '@/constants/terms'
import {
  requireAuth,
  isAuthError,
  checkRateLimit,
  createRateLimitResponse,
  getRateLimitHeaders,
  verifyContractOwnership,
} from '@/lib/security'
import { NextResponse } from 'next/server'
import { ContractType } from '@/types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Authenticate
    const auth = await requireAuth()
    if (isAuthError(auth)) {
      return auth.response
    }
    const { user, supabase } = auth

    // Check rate limit
    const rateLimitResult = await checkRateLimit(user.id, 'process')
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }

    // Get contract and verify ownership
    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !contract) {
      return NextResponse.json(
        { error: 'Contract not found.', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (contract.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Contract not found.', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Check contract status
    if (contract.status === 'completed' || contract.status === 'processing') {
      return NextResponse.json(
        { error: 'Contract has already been processed.', code: 'ALREADY_PROCESSED' },
        { status: 400 }
      )
    }

    if (!contract.contract_text) {
      return NextResponse.json(
        { error: 'Contract text not found.', code: 'NO_TEXT' },
        { status: 400 }
      )
    }

    // Update status to processing
    await supabase
      .from('contracts')
      .update({ status: 'processing' })
      .eq('id', id)

    try {
      // Get custom terms
      const { data: customTermsData } = await supabase
        .from('custom_key_terms')
        .select('term_name')
        .eq('contract_id', id)

      const customTerms = customTermsData?.map((t) => t.term_name) || []
      const contractType = contract.type as ContractType

      // Build prompt and call AI
      const prompt = buildExtractionPrompt({
        contractText: contract.contract_text,
        contractType,
        customTerms,
      })

      const response = await callExtractionAPI(prompt)
      const extractedTerms = parseExtractionResponse(response)

      // Prepare terms for insertion
      const standardTerms = [...STANDARD_TERMS[contractType]]
      const allExpectedTerms = [...standardTerms, ...customTerms]

      const termsToInsert = allExpectedTerms.map((termName) => {
        const extracted = extractedTerms.find(
          (t) => t.term_name.toLowerCase() === termName.toLowerCase()
        )

        return {
          contract_id: id,
          term_name: termName,
          value: extracted?.value || null,
          page_number: extracted?.page_number || null,
          confidence_score: extracted?.confidence_score ?? 0,
          source_sentence: extracted?.source_sentence || null,
          is_manual: customTerms.includes(termName),
          is_edited: false,
          original_value: null,
        }
      })

      // Insert terms
      const { data: insertedTerms, error: insertError } = await supabase
        .from('key_terms')
        .insert(termsToInsert)
        .select()

      if (insertError) {
        console.error('Insert error:', insertError)
        throw new Error('Failed to save extracted terms')
      }

      // Update status to completed
      await supabase
        .from('contracts')
        .update({ status: 'completed' })
        .eq('id', id)

      const response_ = NextResponse.json({
        contract: { id, status: 'completed' },
        terms: insertedTerms,
      })

      // Add rate limit headers to response
      const rateLimitHeaders = getRateLimitHeaders(rateLimitResult)
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response_.headers.set(key, value)
      })

      return response_
    } catch (error) {
      console.error('Extraction error:', error)

      // Revert status to error
      await supabase.from('contracts').update({ status: 'error' }).eq('id', id)

      return NextResponse.json(
        { error: 'AI extraction failed. Please try again.', code: 'EXTRACTION_FAILED' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Process error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
