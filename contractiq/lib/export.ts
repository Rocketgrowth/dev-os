/**
 * Export utilities for contract analysis results
 */

interface KeyTerm {
  id: string
  term_name: string
  value: string | null
  page_number: number | null
  confidence_score: number
  source_sentence: string | null
  is_manual: boolean
  is_edited: boolean
  original_value: string | null
}

interface ContractExportData {
  contract: {
    id: string
    name: string
    type: string
    page_count: number | null
    created_at: string
  }
  terms: KeyTerm[]
  exportedAt: string
}

/**
 * Format contract data for export
 */
export function formatExportData(
  contract: {
    id: string
    name: string
    type: string
    page_count: number | null
    created_at: string
  },
  terms: KeyTerm[]
): ContractExportData {
  return {
    contract: {
      id: contract.id,
      name: contract.name,
      type: contract.type.toUpperCase(),
      page_count: contract.page_count,
      created_at: contract.created_at,
    },
    terms: terms.map((term) => ({
      id: term.id,
      term_name: term.term_name,
      value: term.value,
      page_number: term.page_number,
      confidence_score: term.confidence_score,
      source_sentence: term.source_sentence,
      is_manual: term.is_manual,
      is_edited: term.is_edited,
      original_value: term.original_value,
    })),
    exportedAt: new Date().toISOString(),
  }
}

/**
 * Export data as JSON file
 */
export function exportAsJSON(data: ContractExportData, filename: string): void {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  downloadBlob(blob, `${filename}.json`)
}

/**
 * Export data as CSV file
 */
export function exportAsCSV(data: ContractExportData, filename: string): void {
  const headers = [
    'Term Name',
    'Value',
    'Page Number',
    'Confidence Score',
    'Source Sentence',
    'Is Custom Term',
    'Is Edited',
    'Original Value',
  ]

  const rows = data.terms.map((term) => [
    escapeCSV(term.term_name),
    escapeCSV(term.value || ''),
    term.page_number?.toString() || '',
    `${Math.round(term.confidence_score * 100)}%`,
    escapeCSV(term.source_sentence || ''),
    term.is_manual ? 'Yes' : 'No',
    term.is_edited ? 'Yes' : 'No',
    escapeCSV(term.original_value || ''),
  ])

  // Add metadata rows
  const metadata = [
    ['Contract Name', escapeCSV(data.contract.name)],
    ['Contract Type', data.contract.type],
    ['Page Count', data.contract.page_count?.toString() || ''],
    ['Created At', new Date(data.contract.created_at).toLocaleString()],
    ['Exported At', new Date(data.exportedAt).toLocaleString()],
    [], // Empty row
  ]

  const csvContent = [
    ...metadata.map((row) => row.join(',')),
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

/**
 * Export data as plain text file (for copying/pasting)
 */
export function exportAsText(data: ContractExportData, filename: string): void {
  const lines = [
    '=' .repeat(60),
    `CONTRACT ANALYSIS REPORT`,
    '=' .repeat(60),
    '',
    `Contract: ${data.contract.name}`,
    `Type: ${data.contract.type}`,
    `Pages: ${data.contract.page_count || 'N/A'}`,
    `Analyzed: ${new Date(data.contract.created_at).toLocaleString()}`,
    `Exported: ${new Date(data.exportedAt).toLocaleString()}`,
    '',
    '-'.repeat(60),
    'KEY TERMS',
    '-'.repeat(60),
    '',
  ]

  data.terms.forEach((term) => {
    const confidence = Math.round(term.confidence_score * 100)
    const badges = []
    if (term.is_manual) badges.push('[Custom]')
    if (term.is_edited) badges.push('[Edited]')

    lines.push(`${term.term_name} ${badges.join(' ')}`)
    lines.push(`  Value: ${term.value || 'Not found'}`)
    lines.push(`  Confidence: ${confidence}%`)
    if (term.page_number) {
      lines.push(`  Page: ${term.page_number}`)
    }
    if (term.source_sentence) {
      lines.push(`  Source: "${term.source_sentence}"`)
    }
    lines.push('')
  })

  lines.push('-'.repeat(60))
  lines.push('This analysis is not legal advice. Consult a lawyer before signing.')
  lines.push('-'.repeat(60))

  const textContent = lines.join('\n')
  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' })
  downloadBlob(blob, `${filename}.txt`)
}

/**
 * Escape a value for CSV
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Trigger file download
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
