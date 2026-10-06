'use client'

import { useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, MessageSquare, FileText, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { KeyTermsPanel } from '@/components/contracts/key-terms-panel'
import { TextViewer } from '@/components/contracts/text-viewer'
import { ChatInterface } from '@/components/chat/chat-interface'
import { FeedbackForm } from '@/components/feedback/feedback-form'
import { Disclaimer } from '@/components/shared/disclaimer'
import { ExportButton } from '@/components/contracts/export-button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useContract, useChat } from '@/hooks'

// pdfjs-dist references browser-only APIs (e.g. DOMMatrix) at module load time,
// which crashes under Next.js's Node-based SSR, so this must stay client-only.
const PDFViewer = dynamic(
  () => import('@/components/contracts/pdf-viewer').then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

export default function ContractResultsPage() {
  const params = useParams()
  const router = useRouter()
  const contractId = params.id as string

  const {
    contract,
    terms,
    isLoading: isLoadingContract,
    isError: isContractError,
    error: contractError,
    editTerm,
    deleteContract,
    isDeleting,
  } = useContract(contractId)

  const {
    messages,
    isLoadingHistory,
    isLoading: isChatLoading,
    sendMessage,
  } = useChat(contractId)

  const [targetPage, setTargetPage] = useState<number | undefined>()
  const [viewMode, setViewMode] = useState<'text' | 'pdf'>('text')

  const handleEditTerm = useCallback(
    async (termId: string, value: string) => {
      editTerm({ termId, value })
    },
    [editTerm]
  )

  const handleSendMessage = useCallback(
    async (message: string) => {
      sendMessage(message)
    },
    [sendMessage]
  )

  const handleFeedbackSubmit = useCallback(
    async (rating: -1 | 1, comment?: string) => {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          rating,
          comment,
        }),
      })
    },
    [contractId]
  )

  const handleDelete = useCallback(() => {
    deleteContract(undefined, {
      onSuccess: () => {
        router.push('/dashboard')
      },
    })
  }, [deleteContract, router])

  // Loading state
  if (isLoadingContract) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading contract...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (isContractError || !contract) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
          <p className="mt-4 text-destructive font-medium">
            {contractError || 'Contract not found'}
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Processing state
  if (contract.status === 'processing') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">
            Analyzing contract...
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            This may take a moment.
          </p>
        </div>
      </div>
    )
  }

  // Error status
  if (contract.status === 'error') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
          <p className="mt-4 text-destructive font-medium">
            Analysis failed
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            There was an error processing this contract.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    )
  }

  const hasPdfUrl = !!contract.file_url

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{contract.name}</h1>
            <Badge variant="outline" className="uppercase">
              {contract.type}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {contract.page_count} pages • Reviewed on{' '}
            {new Date(contract.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton contract={contract} terms={terms} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="icon" className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contract</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this contract? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>

      <Disclaimer />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Document */}
        <Card className="lg:h-[700px]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Document
              </CardTitle>
              {hasPdfUrl && (
                <div className="flex gap-1">
                  <Button
                    variant={viewMode === 'text' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('text')}
                  >
                    Text
                  </Button>
                  <Button
                    variant={viewMode === 'pdf' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('pdf')}
                  >
                    PDF
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="h-[calc(100%-60px)]">
            {viewMode === 'pdf' && hasPdfUrl ? (
              <PDFViewer
                url={contract.file_url!}
                currentPage={targetPage}
                onPageChange={setTargetPage}
                className="h-full"
              />
            ) : (
              <TextViewer
                text={contract.contract_text || ''}
                targetPage={targetPage}
                className="h-full"
              />
            )}
          </CardContent>
        </Card>

        {/* Right Panel - Terms & Chat */}
        <div className="space-y-6">
          <Tabs defaultValue="terms" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="terms">Key Terms</TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </TabsTrigger>
            </TabsList>
            <TabsContent value="terms" className="mt-4">
              <Card>
                <CardContent className="pt-6 max-h-[550px] overflow-y-auto">
                  <KeyTermsPanel
                    terms={terms}
                    onEditTerm={handleEditTerm}
                    onPageClick={setTargetPage}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="chat" className="mt-4">
              <Card className="h-[550px]">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ChatInterface
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    onPageClick={setTargetPage}
                    isLoading={isChatLoading}
                  />
                )}
              </Card>
            </TabsContent>
          </Tabs>

          {/* Feedback */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <FeedbackForm
                contractId={contract.id}
                onSubmit={handleFeedbackSubmit}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
