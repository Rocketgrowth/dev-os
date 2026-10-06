'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { MAX_CUSTOM_TERMS } from '@/constants/limits'

interface CustomTermInputProps {
  terms: string[]
  onChange: (terms: string[]) => void
  disabled?: boolean
}

export function CustomTermInput({
  terms,
  onChange,
  disabled,
}: CustomTermInputProps) {
  const [inputValue, setInputValue] = useState('')

  const handleAdd = () => {
    const trimmed = inputValue.trim()
    if (trimmed && !terms.includes(trimmed) && terms.length < MAX_CUSTOM_TERMS) {
      onChange([...terms, trimmed])
      setInputValue('')
    }
  }

  const handleRemove = (term: string) => {
    onChange(terms.filter((t) => t !== term))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const canAddMore = terms.length < MAX_CUSTOM_TERMS

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Custom Terms (optional)</Label>
        <span className="text-xs text-muted-foreground">
          {terms.length}/{MAX_CUSTOM_TERMS}
        </span>
      </div>
      {canAddMore && (
        <div className="flex gap-2">
          <Input
            placeholder="e.g., Non-compete radius"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAdd}
            disabled={disabled || !inputValue.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
      {terms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {terms.map((term) => (
            <Badge key={term} variant="secondary" className="gap-1 pr-1">
              {term}
              <button
                type="button"
                onClick={() => handleRemove(term)}
                className="ml-1 rounded-full hover:bg-muted"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Add up to {MAX_CUSTOM_TERMS} custom terms you want extracted from the
        contract.
      </p>
    </div>
  )
}
