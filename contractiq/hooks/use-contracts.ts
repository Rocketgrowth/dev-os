'use client'

import { useQuery } from '@tanstack/react-query'
import { Contract, ContractStats } from '@/types'

interface UseContractsOptions {
  sort?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

interface ContractsResponse {
  contracts: Contract[]
  total: number
  stats: ContractStats
}

async function fetchContracts(
  options: UseContractsOptions
): Promise<ContractsResponse> {
  const { sort = 'created_at', order = 'desc', limit = 50, offset = 0 } = options

  const params = new URLSearchParams({
    sort,
    order,
    limit: String(limit),
    offset: String(offset),
  })

  const response = await fetch(`/api/contracts?${params}`)
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to fetch contracts')
  }

  return response.json()
}

export function useContracts(options: UseContractsOptions = {}) {
  const { sort = 'created_at', order = 'desc', limit = 50, offset = 0 } = options

  const query = useQuery({
    queryKey: ['contracts', { sort, order, limit, offset }],
    queryFn: () => fetchContracts({ sort, order, limit, offset }),
  })

  return {
    contracts: query.data?.contracts || [],
    total: query.data?.total || 0,
    stats: query.data?.stats,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error?.message,
    refetch: query.refetch,
  }
}
