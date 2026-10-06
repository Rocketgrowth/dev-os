'use client'

import { Download, FileJson, FileText, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  formatExportData,
  exportAsJSON,
  exportAsCSV,
  exportAsText,
} from '@/lib/export'

interface KeyTerm {
  id: string
  term_name: string
  value: string | null
  page_number: number | null
  confidence_score: number | null
  source_sentence: string | null
  is_manual: boolean
  is_edited: boolean
  original_value: string | null
}

interface Contract {
  id: string
  name: string
  type: string
  page_count: number | null
  created_at: string
}

interface ExportButtonProps {
  contract: Contract
  terms: KeyTerm[]
}

export function ExportButton({ contract, terms }: ExportButtonProps) {
  const handleExport = (format: 'json' | 'csv' | 'txt') => {
    const data = formatExportData(contract, terms)
    const sanitizedName = contract.name
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50)
    const filename = `${sanitizedName}_analysis`

    switch (format) {
      case 'json':
        exportAsJSON(data, filename)
        break
      case 'csv':
        exportAsCSV(data, filename)
        break
      case 'txt':
        exportAsText(data, filename)
        break
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('json')}>
          <FileJson className="h-4 w-4 mr-2" />
          JSON
          <span className="ml-auto text-xs text-muted-foreground">Data</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          CSV
          <span className="ml-auto text-xs text-muted-foreground">Excel</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('txt')}>
          <FileText className="h-4 w-4 mr-2" />
          Text
          <span className="ml-auto text-xs text-muted-foreground">Report</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
