'use client'

import { ContractType } from '@/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface ContractTypeSelectorProps {
  value: ContractType
  onChange: (value: ContractType) => void
  disabled?: boolean
}

export function ContractTypeSelector({
  value,
  onChange,
  disabled,
}: ContractTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="contract-type">Contract Type</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as ContractType)}
        disabled={disabled}
      >
        <SelectTrigger id="contract-type">
          <SelectValue placeholder="Select contract type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nda">
            <div className="flex flex-col items-start">
              <span className="font-medium">NDA</span>
              <span className="text-xs text-muted-foreground">
                Non-Disclosure Agreement
              </span>
            </div>
          </SelectItem>
          <SelectItem value="msa">
            <div className="flex flex-col items-start">
              <span className="font-medium">MSA</span>
              <span className="text-xs text-muted-foreground">
                Master Service Agreement
              </span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
