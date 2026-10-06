import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DisclaimerProps {
  className?: string
  variant?: 'default' | 'compact'
}

export function Disclaimer({ className, variant = 'default' }: DisclaimerProps) {
  if (variant === 'compact') {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        This is an AI-assisted review tool, not legal advice.
      </p>
    )
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4',
        className
      )}
    >
      <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-warning-foreground">Not Legal Advice</p>
        <p className="mt-1 text-muted-foreground">
          ContractIQ is an AI-assisted review tool. Always verify critical terms
          with a qualified lawyer before signing any contract.
        </p>
      </div>
    </div>
  )
}
