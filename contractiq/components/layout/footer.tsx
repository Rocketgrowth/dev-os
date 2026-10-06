import Link from 'next/link'
import { FileText } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>ContractIQ</span>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          ContractIQ is an AI-assisted review tool, not legal advice.
        </p>
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} ContractIQ. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
