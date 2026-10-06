import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { STANDARD_TERMS } from '@/constants/terms'
import { ContractType } from '@/types'

interface TermsPreviewProps {
  contractType: ContractType
  customTerms: string[]
}

export function TermsPreview({ contractType, customTerms }: TermsPreviewProps) {
  const standardTerms = STANDARD_TERMS[contractType]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Terms to Extract</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">
            Standard {contractType.toUpperCase()} Terms
          </p>
          <div className="flex flex-wrap gap-2">
            {standardTerms.map((term) => (
              <Badge key={term} variant="outline">
                {term}
              </Badge>
            ))}
          </div>
        </div>
        {customTerms.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Custom Terms
            </p>
            <div className="flex flex-wrap gap-2">
              {customTerms.map((term) => (
                <Badge key={term} variant="secondary">
                  {term}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
