import { createClient } from '@/lib/supabase/server'
import { SIGNED_URL_EXPIRY_SECONDS } from '@/constants/limits'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !contract) {
      return NextResponse.json(
        { error: 'Contract not found.' },
        { status: 404 }
      )
    }

    if (contract.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let fileUrl = null
    if (contract.file_path) {
      const { data: signedUrlData } = await supabase.storage
        .from('contracts')
        .createSignedUrl(contract.file_path, SIGNED_URL_EXPIRY_SECONDS)
      fileUrl = signedUrlData?.signedUrl || null
    }

    const { data: terms } = await supabase
      .from('key_terms')
      .select('*')
      .eq('contract_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      contract: {
        ...contract,
        file_url: fileUrl,
      },
      terms: terms || [],
    })
  } catch (error) {
    console.error('Contract fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: contract, error: fetchError } = await supabase
      .from('contracts')
      .select('id, user_id, file_path')
      .eq('id', id)
      .single()

    if (fetchError || !contract) {
      return NextResponse.json(
        { error: 'Contract not found.' },
        { status: 404 }
      )
    }

    if (contract.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (contract.file_path) {
      await supabase.storage.from('contracts').remove([contract.file_path])
    }

    const { error: deleteError } = await supabase
      .from('contracts')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete contract.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contract delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
