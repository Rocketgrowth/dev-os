import { createClient } from '@/lib/supabase/server'
import { updateKeyTermSchema } from '@/lib/validation/schemas'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; termId: string }> }
) {
  try {
    const { id, termId } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateKeyTermSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('user_id')
      .eq('id', id)
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

    const { data: term, error: termError } = await supabase
      .from('key_terms')
      .select('*')
      .eq('id', termId)
      .eq('contract_id', id)
      .single()

    if (termError || !term) {
      return NextResponse.json({ error: 'Term not found.' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {
      value: parsed.data.value,
      is_edited: true,
    }

    if (!term.is_edited && !term.original_value) {
      updateData.original_value = term.value
    }

    const { data: updatedTerm, error: updateError } = await supabase
      .from('key_terms')
      .update(updateData)
      .eq('id', termId)
      .select()
      .single()

    if (updateError) {
      console.error('Term update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update term.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ term: updatedTerm })
  } catch (error) {
    console.error('Term edit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
