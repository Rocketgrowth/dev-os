'use client'

import { KeyTerm } from '@/types'
import { KeyTermRow } from './key-term-row'
import { Disclaimer } from '@/components/shared/disclaimer'

interface KeyTermsPanelProps {
  terms: KeyTerm[]
  onEditTerm?: (termId: string, value: string) => Promise<void>
  onPageClick?: (page: number) => void
}

export function KeyTermsPanel({
  terms,
  onEditTerm,
  onPageClick,
}: KeyTermsPanelProps) {
  const standardTerms = terms.filter((t) => !t.is_manual)
  const customTerms = terms.filter((t) => t.is_manual)

  return (
    <div className="space-y-4">
      <Disclaimer variant="compact" />

      {standardTerms.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground">
            Standard Terms ({standardTerms.length})
          </h3>
          <div className="space-y-2">
            {standardTerms.map((term) => (
              <KeyTermRow
                key={term.id}
                term={term}
                onEdit={onEditTerm}
                onPageClick={onPageClick}
              />
            ))}
          </div>
        </div>
      )}

      {customTerms.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground">
            Custom Terms ({customTerms.length})
          </h3>
          <div className="space-y-2">
            {customTerms.map((term) => (
              <KeyTermRow
                key={term.id}
                term={term}
                onEdit={onEditTerm}
                onPageClick={onPageClick}
              />
            ))}
          </div>
        </div>
      )}

      {terms.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No terms extracted yet.
        </p>
      )}
    </div>
  )
}
