'use client'

import { useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { UploadDropzone } from '@/components/contracts/upload-dropzone'
import { ContractTypeSelector } from '@/components/contracts/contract-type-selector'
import { CustomTermInput } from '@/components/contracts/custom-term-input'
import { TermsPreview } from '@/components/contracts/terms-preview'
import { ContractType } from '@/types'
import { useUpload } from '@/hooks'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [contractType, setContractType] = useState<ContractType>('nda')
  const [customTerms, setCustomTerms] = useState<string[]>([])

  const { upload, isLoading, isUploading, isProcessing, error, progress, reset } = useUpload()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    await upload(file, contractType, customTerms)
  }

  const getProgressText = () => {
    if (isUploading) return 'Uploading contract...'
    if (isProcessing) return 'Analyzing contract with AI...'
    return 'Processing...'
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Review a Contract</h1>
          <p className="text-muted-foreground">
            Upload your NDA or MSA to get AI-extracted key terms
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Upload PDF</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadDropzone
              file={file}
              onFileSelect={setFile}
              disabled={isLoading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Select Contract Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ContractTypeSelector
              value={contractType}
              onChange={setContractType}
              disabled={isLoading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Add Custom Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomTermInput
              terms={customTerms}
              onChange={setCustomTerms}
              disabled={isLoading}
            />
          </CardContent>
        </Card>

        <TermsPreview contractType={contractType} customTerms={customTerms} />

        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{getProgressText()}</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={reset}>
              Try Again
            </Button>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={!file || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? getProgressText() : 'Process Contract'}
          </Button>
        </div>
      </form>
    </div>
  )
}
