'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Contract, KeyTerm } from '@/types'

interface ContractResponse {
  contract: Contract & { file_url?: string | null }
  terms: KeyTerm[]
}

async function fetchContract(contractId: string): Promise<ContractResponse> {
  const response = await fetch(`/api/contracts/${contractId}`)
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to fetch contract')
  }
  return response.json()
}

async function editTerm(
  contractId: string,
  termId: string,
  value: string
): Promise<{ term: KeyTerm }> {
  const response = await fetch(`/api/contracts/${contractId}/terms/${termId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to update term')
  }
  return response.json()
}

async function deleteContract(contractId: string): Promise<void> {
  const response = await fetch(`/api/contracts/${contractId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const data = await response.json()
    throw new Error(data.error || 'Failed to delete contract')
  }
}

export function useContract(contractId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => fetchContract(contractId),
    enabled: !!contractId,
  })

  const editTermMutation = useMutation({
    mutationFn: ({ termId, value }: { termId: string; value: string }) =>
      editTerm(contractId, termId, value),
    onMutate: async ({ termId, value }) => {
      await queryClient.cancelQueries({ queryKey: ['contract', contractId] })

      const previous = queryClient.getQueryData<ContractResponse>([
        'contract',
        contractId,
      ])

      queryClient.setQueryData<ContractResponse>(
        ['contract', contractId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            terms: old.terms.map((t) =>
              t.id === termId
                ? {
                    ...t,
                    value,
                    is_edited: true,
                    original_value: t.original_value || t.value,
                  }
                : t
            ),
          }
        }
      )

      return { previous }
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['contract', contractId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteContract(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
    },
  })

  return {
    contract: query.data?.contract,
    terms: query.data?.terms || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error?.message,
    refetch: query.refetch,
    editTerm: editTermMutation.mutate,
    isEditingTerm: editTermMutation.isPending,
    editTermError: editTermMutation.error?.message,
    deleteContract: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  }
}
