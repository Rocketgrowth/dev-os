'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Edit2, Check, X, AlertTriangle } from 'lucide-react'
import { KeyTerm } from '@/types'
import { cn, formatConfidence, getConfidenceColor, getConfidenceLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface KeyTermRowProps {
  term: KeyTerm
  onEdit?: (termId: string, value: string) => Promise<void>
  onPageClick?: (page: number) => void
}

export function KeyTermRow({ term, onEdit, onPageClick }: KeyTermRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(term.value || '')
  const [isSaving, setIsSaving] = useState(false)

  const confidenceScore = term.confidence_score ?? 0
  const isLowConfidence = confidenceScore < 0.5
  const confidenceColor = getConfidenceColor(confidenceScore)

  const handleSave = async () => {
    if (!onEdit) return
    setIsSaving(true)
    try {
      await onEdit(term.id, editValue)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(term.value || '')
    setIsEditing(false)
  }

  return (
    <div className="border rounded-lg">
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{term.term_name}</span>
            {term.is_manual && (
              <Badge variant="secondary" className="text-xs">
                Custom
              </Badge>
            )}
            {term.is_edited && (
              <Badge variant="outline" className="text-xs">
                Edited
              </Badge>
            )}
            {isLowConfidence && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="h-4 w-4 text-warning" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Low confidence — verify this in the document directly</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-8"
                autoFocus
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {term.value || (
                <span className="italic">Not found in document</span>
              )}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {term.page_number && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => onPageClick?.(term.page_number!)}
            >
              Page {term.page_number}
            </Button>
          )}

          <Badge
            variant={confidenceColor}
            className={cn(
              'min-w-[60px] justify-center',
              confidenceColor === 'success' && 'bg-green-100 text-green-800',
              confidenceColor === 'warning' && 'bg-yellow-100 text-yellow-800',
              confidenceColor === 'destructive' && 'bg-red-100 text-red-800'
            )}
          >
            {formatConfidence(confidenceScore)}
          </Badge>

          {!isEditing && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}

          {term.source_sentence && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {isExpanded && term.source_sentence && (
        <div className="px-4 pb-4 pt-0">
          <div className="rounded bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Source from document:
            </p>
            <p className="text-sm italic">&ldquo;{term.source_sentence}&rdquo;</p>
          </div>
        </div>
      )}
    </div>
  )
}
