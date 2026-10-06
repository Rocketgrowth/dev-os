# Dashboard Specification

## Overview

The dashboard shows all contracts for the current user with summary statistics. Users can view their contract history, start a new review, and navigate to individual contract results.

---

## User Flow

```
1. User signs in or navigates to /dashboard
2. Dashboard loads with:
   - Summary stats (total contracts, by type)
   - List of contracts (sorted by date, newest first)
3. If no contracts: show empty state with CTA
4. User can:
   - Click "Review Contract" → navigate to /upload
   - Click contract row → navigate to /contracts/[id]
   - Sort list by name, type, date, status
```

---

## API Route

### GET /api/contracts

**File:** `app/api/contracts/route.ts`

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| sort | string | "created_at" | Sort field: created_at, name, type |
| order | string | "desc" | Sort order: asc, desc |
| limit | number | 50 | Max results (max: 100) |
| offset | number | 0 | Pagination offset |

**Success Response (200):**
```json
{
  "contracts": [
    {
      "id": "uuid",
      "name": "Vendor NDA - Acme Corp",
      "type": "nda",
      "status": "completed",
      "page_count": 8,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 42,
  "stats": {
    "total": 42,
    "nda": 28,
    "msa": 14,
    "pending": 2,
    "processing": 1,
    "completed": 38,
    "error": 1
  }
}
```

**Implementation:**
```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sort = searchParams.get('sort') || 'created_at'
  const order = searchParams.get('order') || 'desc'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  // Validate sort field
  const validSortFields = ['created_at', 'name', 'type', 'status']
  const sortField = validSortFields.includes(sort) ? sort : 'created_at'

  // Fetch contracts
  const { data: contracts, error, count } = await supabase
    .from('contracts')
    .select('id, name, type, status, page_count, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order(sortField, { ascending: order === 'asc' })
    .range(offset, offset + limit - 1)

  if (error) {
    return Response.json({ error: 'Failed to fetch contracts' }, { status: 500 })
  }

  // Calculate stats
  const { data: allContracts } = await supabase
    .from('contracts')
    .select('type, status')
    .eq('user_id', user.id)

  const stats = {
    total: allContracts?.length || 0,
    nda: allContracts?.filter(c => c.type === 'nda').length || 0,
    msa: allContracts?.filter(c => c.type === 'msa').length || 0,
    pending: allContracts?.filter(c => c.status === 'pending').length || 0,
    processing: allContracts?.filter(c => c.status === 'processing').length || 0,
    completed: allContracts?.filter(c => c.status === 'completed').length || 0,
    error: allContracts?.filter(c => c.status === 'error').length || 0,
  }

  return Response.json({
    contracts: contracts || [],
    total: count || 0,
    stats,
  })
}
```

---

## Page Layout

**File:** `app/(dashboard)/dashboard/page.tsx`

**Structure:**
```
┌────────────────────────────────────────────────────────────┐
│ Header: Dashboard | [Review Contract] button               │
├────────────────────────────────────────────────────────────┤
│ Stats Cards: Total | NDAs | MSAs                           │
├────────────────────────────────────────────────────────────┤
│ Contract List                                              │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Sort: [Dropdown]                                     │   │
│ ├──────────────────────────────────────────────────────┤   │
│ │ Contract 1 | Type | Status | Date | →                │   │
│ │ Contract 2 | Type | Status | Date | →                │   │
│ │ ...                                                  │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                            │
│ OR                                                         │
│                                                            │
│ [Empty State: No contracts yet. Upload your first one!]   │
└────────────────────────────────────────────────────────────┘
```

**Implementation:**
```typescript
import { Suspense } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContractList } from '@/components/contracts/contract-list'
import { DashboardStats } from '@/components/contracts/dashboard-stats'
import { DashboardSkeleton } from '@/components/contracts/dashboard-skeleton'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            View and manage your contract reviews
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Plus className="mr-2 h-4 w-4" />
            Review Contract
          </Link>
        </Button>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}

async function DashboardContent() {
  // This would be a server component fetching data
  // For client-side, use useContracts hook
  return (
    <>
      <DashboardStats />
      <ContractList />
    </>
  )
}
```

---

## Frontend Components

### DashboardStats Component

**File:** `components/contracts/dashboard-stats.tsx`

**Features:**
- 3-column grid on desktop
- Cards for: Total Contracts, NDAs, MSAs
- Count display with icon

**Implementation:**
```typescript
'use client'

import { FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useContracts } from '@/hooks/use-contracts'

export function DashboardStats() {
  const { stats, isLoading } = useContracts()

  if (isLoading) {
    return <StatsSkeletion />
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.total || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">NDAs</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.nda || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">MSAs</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.msa || 0}</div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### ContractList Component

**File:** `components/contracts/contract-list.tsx`

**Features:**
- Sortable table/list
- Sort dropdown: Date (default), Name, Type
- Each row shows: name, type badge, status indicator, date
- Click row → navigate to results page
- Empty state when no contracts

**Implementation:**
```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { useContracts } from '@/hooks/use-contracts'

export function ContractList() {
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const { contracts, isLoading } = useContracts({ sort: sortBy, order: sortOrder })

  if (isLoading) {
    return <ContractListSkeleton />
  }

  if (contracts.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No contracts reviewed yet"
        description="Upload your first NDA or MSA to get started with AI-powered contract review."
        action={
          <Button asChild>
            <Link href="/upload">
              <Plus className="mr-2 h-4 w-4" />
              Upload Your First Contract
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Contracts</CardTitle>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Date</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="type">Type</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {contracts.map((contract) => (
            <Link
              key={contract.id}
              href={`/contracts/${contract.id}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{contract.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{contract.type.toUpperCase()}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {contract.page_count} pages
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {new Date(contract.created_at).toLocaleDateString()}
                </span>
                <StatusIndicator status={contract.status} />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function StatusIndicator({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case 'processing':
      return <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
    case 'pending':
      return <Clock className="h-5 w-5 text-muted-foreground" />
    case 'error':
      return <AlertCircle className="h-5 w-5 text-red-500" />
    default:
      return null
  }
}
```

### ContractCard Component

**File:** `components/contracts/contract-card.tsx`

**Props:**
```typescript
interface ContractCardProps {
  contract: {
    id: string
    name: string
    type: 'nda' | 'msa'
    status: 'pending' | 'processing' | 'completed' | 'error'
    page_count: number
    created_at: string
  }
}
```

### EmptyState Component

**File:** `components/shared/empty-state.tsx`

**Props:**
```typescript
interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
}
```

**Implementation:**
```typescript
import { Card, CardContent } from '@/components/ui/card'

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Icon className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
          {description}
        </p>
        {action}
      </CardContent>
    </Card>
  )
}
```

---

## Hooks

### useContracts Hook

**File:** `hooks/use-contracts.ts`

```typescript
import { useQuery } from '@tanstack/react-query'

interface UseContractsOptions {
  sort?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export function useContracts(options: UseContractsOptions = {}) {
  const { sort = 'created_at', order = 'desc', limit = 50, offset = 0 } = options

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contracts', { sort, order, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams({
        sort,
        order,
        limit: String(limit),
        offset: String(offset),
      })
      const res = await fetch(`/api/contracts?${params}`)
      if (!res.ok) throw new Error('Failed to fetch contracts')
      return res.json()
    },
  })

  return {
    contracts: data?.contracts || [],
    total: data?.total || 0,
    stats: data?.stats,
    isLoading,
    error: error?.message,
    refetch,
  }
}
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| No contracts | Show empty state with CTA |
| Contract processing | Show spinner icon, no link |
| Contract errored | Show error icon, allow retry |
| Many contracts | Paginate (load more or pagination) |
| Network error | Show error toast, retry button |
| Slow load | Show skeleton loaders |

---

## Acceptance Criteria

- [ ] Summary cards show: total contracts, NDAs, MSAs
- [ ] Sortable list: name, type, date, status
- [ ] Click contract row → opens results page
- [ ] Empty state with CTA for new users
- [ ] "Review Contract" button links to /upload
- [ ] Status indicators: completed (check), processing (spinner), error (alert)
- [ ] Responsive layout: cards stack on mobile
