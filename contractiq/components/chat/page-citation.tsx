import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageCitationProps {
  page: number
  onClick?: () => void
}

export function PageCitation({ page, onClick }: PageCitationProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      <FileText className="h-3 w-3 mr-1" />
      Page {page}
    </Button>
  )
}
