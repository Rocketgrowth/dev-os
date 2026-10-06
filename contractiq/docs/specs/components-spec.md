# UI Components Specification

## Overview

This spec defines all React components for ContractIQ, using shadcn/ui as the component library with Tailwind CSS styling.

---

## Component Library Setup

### Dependencies

```bash
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-progress class-variance-authority clsx tailwind-merge lucide-react
```

### shadcn/ui Components to Install

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog dropdown-menu input label badge tooltip progress skeleton tabs textarea scroll-area table
```

---

## Component Hierarchy

```
components/
├── ui/                             # shadcn/ui primitives
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── badge.tsx
│   ├── tooltip.tsx
│   ├── progress.tsx
│   ├── skeleton.tsx
│   ├── tabs.tsx
│   ├── textarea.tsx
│   ├── scroll-area.tsx
│   ├── table.tsx
│   └── toaster.tsx
├── layout/
│   ├── header.tsx                  # App header
│   ├── sidebar.tsx                 # Dashboard sidebar
│   └── footer.tsx                  # Marketing footer
├── auth/
│   ├── auth-form.tsx               # Login/signup form
│   └── user-menu.tsx               # User dropdown
├── contracts/
│   ├── contract-list.tsx           # Dashboard contract table
│   ├── contract-card.tsx           # Contract summary card
│   ├── upload-dropzone.tsx         # Drag-and-drop upload
│   ├── contract-type-selector.tsx  # NDA/MSA dropdown
│   ├── custom-term-input.tsx       # Add custom term
│   ├── processing-progress.tsx     # 3-step progress
│   ├── pdf-viewer.tsx              # PDF.js wrapper
│   ├── text-viewer.tsx             # Text fallback viewer
│   ├── key-terms-panel.tsx         # Terms list container
│   ├── key-term-row.tsx            # Single term row
│   ├── confidence-badge.tsx        # Color-coded badge
│   └── source-sentence.tsx         # Expandable source
├── chat/
│   ├── chat-interface.tsx          # Chat container
│   ├── chat-message.tsx            # Message bubble
│   ├── chat-input.tsx              # Input with send
│   └── page-citation.tsx           # Clickable citation
├── feedback/
│   └── feedback-form.tsx           # Rating + comment
└── shared/
    ├── loading-spinner.tsx
    ├── empty-state.tsx
    ├── error-boundary.tsx
    └── disclaimer.tsx              # "Not legal advice" banner
```

---

## Layout Components

### `components/layout/header.tsx`

```typescript
'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { UserMenu } from '@/components/auth/user-menu'
import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'

export function Header() {
  const { user, loading } = useAuth()

  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">ContractIQ</span>
        </Link>

        <nav className="flex items-center gap-4">
          {loading ? (
            <div className="h-8 w-8 animate-pulse bg-muted rounded-full" />
          ) : user ? (
            <UserMenu />
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
```

---

### `components/layout/sidebar.tsx`

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, FileText, Settings } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'New Contract', icon: Upload },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r bg-muted/30">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

---

## Auth Components

### `components/auth/auth-form.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { signInSchema, signUpSchema, type SignInInput, type SignUpInput } from '@/lib/validation/auth-schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'

interface AuthFormProps {
  mode: 'login' | 'signup'
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const schema = mode === 'login' ? signInSchema : signUpSchema
  type FormData = typeof mode extends 'login' ? SignInInput : SignUpInput

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setError(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
        })
        if (error) throw error
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{mode === 'login' ? 'Sign In' : 'Create Account'}</CardTitle>
        <CardDescription>
          {mode === 'login'
            ? 'Enter your credentials to access your account'
            : 'Enter your details to create a new account'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </Button>

          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <Link href="/signup" className="text-primary hover:underline">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
```

---

### `components/auth/user-menu.tsx`

```typescript
'use client'

import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { User, LogOut, Settings } from 'lucide-react'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="h-4 w-4" />
          <span className="hidden md:inline">{user?.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## Contract Components

### `components/contracts/contract-type-selector.tsx`

```typescript
'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ContractTypeSelectorProps {
  value: 'nda' | 'msa' | ''
  onChange: (value: 'nda' | 'msa') => void
}

export function ContractTypeSelector({ value, onChange }: ContractTypeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Contract Type</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select contract type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nda">
            <div className="flex flex-col">
              <span className="font-medium">NDA</span>
              <span className="text-xs text-muted-foreground">
                Non-Disclosure Agreement
              </span>
            </div>
          </SelectItem>
          <SelectItem value="msa">
            <div className="flex flex-col">
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
```

---

### `components/contracts/custom-term-input.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, X } from 'lucide-react'

interface CustomTermInputProps {
  terms: string[]
  onChange: (terms: string[]) => void
  maxTerms?: number
}

export function CustomTermInput({
  terms,
  onChange,
  maxTerms = 5,
}: CustomTermInputProps) {
  const [inputValue, setInputValue] = useState('')

  const handleAdd = () => {
    const trimmed = inputValue.trim()
    if (trimmed && !terms.includes(trimmed) && terms.length < maxTerms) {
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

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Add a custom term to extract..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={terms.length >= maxTerms}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          disabled={!inputValue.trim() || terms.length >= maxTerms}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {terms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {terms.map((term) => (
            <Badge key={term} variant="secondary" className="gap-1">
              {term}
              <button
                type="button"
                onClick={() => handleRemove(term)}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {terms.length}/{maxTerms} custom terms
      </p>
    </div>
  )
}
```

---

### `components/contracts/processing-progress.tsx`

```typescript
'use client'

import { Progress } from '@/components/ui/progress'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProcessingProgressProps {
  currentStep: 1 | 2 | 3
  error?: string
}

const steps = [
  { id: 1, label: 'Uploading', description: 'Extracting text from PDF...' },
  { id: 2, label: 'Analyzing', description: 'AI is extracting key terms...' },
  { id: 3, label: 'Compiling', description: 'Preparing your results...' },
]

export function ProcessingProgress({ currentStep, error }: ProcessingProgressProps) {
  const progress = (currentStep / 3) * 100

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground text-center">
          Step {currentStep} of 3
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step) => {
          const isComplete = step.id < currentStep
          const isCurrent = step.id === currentStep
          const isPending = step.id > currentStep

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                isCurrent && 'bg-primary/10',
                isComplete && 'opacity-60'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  isComplete && 'bg-green-500 text-white',
                  isCurrent && 'bg-primary text-primary-foreground',
                  isPending && 'bg-muted text-muted-foreground'
                )}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  step.id
                )}
              </div>
              <div>
                <p className={cn('font-medium', isPending && 'text-muted-foreground')}>
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive">
          <p className="font-medium">Processing failed</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
```

---

## Shared Components

### `components/shared/empty-state.tsx`

```typescript
import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
```

---

### `components/shared/disclaimer.tsx`

```typescript
import { AlertTriangle } from 'lucide-react'

export function Disclaimer() {
  return (
    <div className="border-t bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <p className="text-sm">
          This analysis is not legal advice. Always consult a qualified attorney before signing any contract.
        </p>
      </div>
    </div>
  )
}
```

---

### `components/shared/loading-spinner.tsx`

```typescript
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  }

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Loader2 className={cn('animate-spin text-muted-foreground', sizeClasses[size])} />
    </div>
  )
}
```

---

## Acceptance Criteria

- [ ] All shadcn/ui components installed and configured
- [ ] Tailwind CSS properly configured with design tokens
- [ ] Header renders with logo and navigation
- [ ] Sidebar renders with active state
- [ ] Auth forms validate input and show errors
- [ ] User menu shows email and sign out option
- [ ] Upload dropzone accepts drag-and-drop
- [ ] Contract type selector shows NDA/MSA options
- [ ] Custom term input allows add/remove
- [ ] Processing progress shows 3-step indicator
- [ ] Empty state renders with icon and CTA
- [ ] Disclaimer banner shows legal warning
- [ ] All components are accessible (keyboard, ARIA)
- [ ] Components support dark mode
