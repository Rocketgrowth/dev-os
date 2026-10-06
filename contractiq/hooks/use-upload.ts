'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ContractType } from '@/types'

interface UploadResult {
  contract: {
    id: string
    name: string
    type: ContractType
    status: string
    page_count: number
    created_at: string
  }
}

export function useUpload() {
  const router = useRouter()
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const upload = useCallback(
    async (
      file: File,
      type: ContractType,
      customTerms: string[] = []
    ): Promise<string | null> => {
      setIsUploading(true)
      setIsProcessing(false)
      setError(null)
      setProgress(0)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', type)
        formData.append('customTerms', JSON.stringify(customTerms))

        setProgress(25)

        const uploadResponse = await fetch('/api/contracts/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const data = await uploadResponse.json()
          throw new Error(data.error || 'Upload failed')
        }

        const { contract }: UploadResult = await uploadResponse.json()

        setProgress(50)
        setIsUploading(false)
        setIsProcessing(true)

        const processResponse = await fetch(
          `/api/contracts/${contract.id}/process`,
          {
            method: 'POST',
          }
        )

        setProgress(75)

        if (!processResponse.ok) {
          const data = await processResponse.json()
          throw new Error(data.error || 'Processing failed')
        }

        setProgress(100)
        setIsProcessing(false)

        router.push(`/contracts/${contract.id}`)
        return contract.id
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setIsUploading(false)
        setIsProcessing(false)
        setProgress(0)
        return null
      }
    },
    [router]
  )

  const reset = useCallback(() => {
    setIsUploading(false)
    setIsProcessing(false)
    setError(null)
    setProgress(0)
  }, [])

  return {
    upload,
    reset,
    isUploading,
    isProcessing,
    isLoading: isUploading || isProcessing,
    error,
    progress,
  }
}
