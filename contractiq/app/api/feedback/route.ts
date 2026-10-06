import { createClient } from '@/lib/supabase/server'
import { createFeedbackSchema } from '@/lib/validation/schemas'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createFeedbackSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { contract_id, rating, comment } = parsed.data

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, user_id')
      .eq('id', contract_id)
      .single()

    if (contractError || !contract) {
      return NextResponse.json(
        { error: 'Contract not found.' },
        { status: 404 }
      )
    }

    if (contract.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: existing } = await supabase
      .from('user_feedback')
      .select('id')
      .eq('user_id', user.id)
      .eq('contract_id', contract_id)
      .single()

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from('user_feedback')
        .update({ rating, comment: comment || null })
        .eq('id', existing.id)
        .select('id, created_at')
        .single()

      if (updateError) {
        console.error('Feedback update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update feedback.' },
          { status: 500 }
        )
      }

      return NextResponse.json({ feedback: updated })
    }

    const { data: feedback, error: insertError } = await supabase
      .from('user_feedback')
      .insert({
        user_id: user.id,
        contract_id,
        rating,
        comment: comment || null,
      })
      .select('id, created_at')
      .single()

    if (insertError) {
      console.error('Feedback insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to submit feedback.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ feedback }, { status: 201 })
  } catch (error) {
    console.error('Feedback error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
