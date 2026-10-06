import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/constants/limits'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sort = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') || 'desc'
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE)),
      MAX_PAGE_SIZE
    )
    const offset = parseInt(searchParams.get('offset') || '0')

    const validSortFields = ['created_at', 'name', 'type', 'status']
    const sortField = validSortFields.includes(sort) ? sort : 'created_at'
    const ascending = order === 'asc'

    const {
      data: contracts,
      error,
      count,
    } = await supabase
      .from('contracts')
      .select('id, name, type, status, page_count, created_at', {
        count: 'exact',
      })
      .eq('user_id', user.id)
      .order(sortField, { ascending })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Contracts fetch error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch contracts' },
        { status: 500 }
      )
    }

    const { data: allContracts } = await supabase
      .from('contracts')
      .select('type, status')
      .eq('user_id', user.id)

    const stats = {
      total: allContracts?.length || 0,
      nda: allContracts?.filter((c) => c.type === 'nda').length || 0,
      msa: allContracts?.filter((c) => c.type === 'msa').length || 0,
      pending: allContracts?.filter((c) => c.status === 'pending').length || 0,
      processing:
        allContracts?.filter((c) => c.status === 'processing').length || 0,
      completed:
        allContracts?.filter((c) => c.status === 'completed').length || 0,
      error: allContracts?.filter((c) => c.status === 'error').length || 0,
    }

    return NextResponse.json({
      contracts: contracts || [],
      total: count || 0,
      stats,
    })
  } catch (error) {
    console.error('Contracts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
