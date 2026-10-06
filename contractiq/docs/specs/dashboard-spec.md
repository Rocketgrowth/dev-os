# Dashboard Specification

## Overview

The dashboard is the main hub after login. It displays all contracts the user has reviewed, with sorting and quick actions.

---

## User Flow

```
1. User signs in (or is already authenticated)
2. Navigate to /dashboard
3. If no contracts: Show empty state with CTA
4. If contracts exist: Show summary stats + sortable list
5. User can click "Review a Contract" to upload new
6. User can click any contract row to view results
7. User can sort by name, type, date, or status
```

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Header                                              [User Menu]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Welcome back, {firstName}                                  ││
│  │                                                             ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  ││
│  │  │ Total: 12 │  │ NDAs: 8  │  │ MSAs: 4  │                  ││
│  │  └──────────┘  └──────────┘  └──────────┘                  ││
│  │                                                             ││
│  │  [+ Review a Contract]                                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Your Contracts                                    [Sort ▼] ││
│  │ ───────────────────────────────────────────────────────────││
│  │  Name                  Type    Status     Date             ││
│  │ ───────────────────────────────────────────────────────────││
│  │  Vendor NDA - Acme     NDA     Completed  Aug 15, 2024     ││
│  │  MSA - ClientCo        MSA     Completed  Aug 12, 2024     ││
│  │  Partner NDA - Beta    NDA     Processing Aug 10, 2024     ││
│  │  ...                                                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Empty State

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    [Illustration: Documents]                    │
│                                                                 │
│                  No contracts reviewed yet                      │
│                                                                 │
│         Upload your first contract to get started               │
│                                                                 │
│                   [+ Review a Contract]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/(dashboard)/page.tsx` | Dashboard page |
| `src/app/(dashboard)/layout.tsx` | Dashboard layout with sidebar/header |
| `src/components/layout/header.tsx` | App header with user menu |
| `src/components/layout/sidebar.tsx` | Dashboard sidebar navigation |
| `src/components/contracts/contract-list.tsx` | Sortable contract table |
| `src/components/contracts/contract-card.tsx` | Single contract row |
| `src/components/shared/empty-state.tsx` | Reusable empty state |
| `src/app/api/contracts/route.ts` | List contracts API |
| `src/hooks/use-contracts.ts` | Contracts query hook |

---

### `src/app/(dashboard)/page.tsx`

```typescript
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ContractList } from '@/components/contracts/contract-list'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, FileText, FileCheck } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch contracts
  const { data: contracts } = await supabase
    .from('contracts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const contractList = contracts || []
  const ndaCount = contractList.filter(c => c.type === 'nda').length
  const msaCount = contractList.filter(c => c.type === 'msa').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground">
            Manage and review your contracts
          </p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Plus className="h-4 w-4 mr-2" />
            Review a Contract
          </Link>
        </Button>
      </div>

      {contractList.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No contracts reviewed yet"
          description="Upload your first contract to get started"
          action={
            <Button asChild>
              <Link href="/upload">
                <Plus className="h-4 w-4 mr-2" />
                Review a Contract
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Contracts
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{contractList.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">NDAs</CardTitle>
                <FileCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{ndaCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">MSAs</CardTitle>
                <FileCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{msaCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Contract List */}
          <Suspense fallback={<div>Loading...</div>}>
            <ContractList contracts={contractList} />
          </Suspense>
        </>
      )}
    </div>
  )
}
```

---

### `src/components/contracts/contract-list.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, MoreHorizontal, Eye, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Contract {
  id: string
  name: string
  type: 'nda' | 'msa'
  status: 'pending' | 'processing' | 'completed' | 'error'
  page_count: number
  created_at: string
}

interface ContractListProps {
  contracts: Contract[]
}

type SortField = 'name' | 'type' | 'status' | 'created_at'
type SortOrder = 'asc' | 'desc'

export function ContractList({ contracts }: ContractListProps) {
  const router = useRouter()
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const sortedContracts = [...contracts].sort((a, b) => {
    const aVal = a[sortField]
    const bVal = b[sortField]
    const order = sortOrder === 'asc' ? 1 : -1

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * order
    }
    return 0
  })

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button variant="ghost" onClick={() => toggleSort('name')}>
                Name
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => toggleSort('type')}>
                Type
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => toggleSort('status')}>
                Status
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" onClick={() => toggleSort('created_at')}>
                Date
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedContracts.map((contract) => (
            <TableRow
              key={contract.id}
              className="cursor-pointer"
              onClick={() => router.push(`/contracts/${contract.id}`)}
            >
              <TableCell className="font-medium">{contract.name}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {contract.type.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={statusColors[contract.status]}>
                  {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(contract.created_at), { addSuffix: true })}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/contracts/${contract.id}`)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        // TODO: Delete confirmation
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

---

### `src/app/api/contracts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') || 'desc'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Fetch contracts
    const { data: contracts, error, count } = await supabase
      .from('contracts')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    return NextResponse.json({
      contracts: contracts || [],
      total: count || 0,
    })

  } catch (error) {
    console.error('List contracts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Acceptance Criteria

- [ ] Dashboard shows after successful login
- [ ] Empty state shown when no contracts exist
- [ ] Empty state has CTA to upload first contract
- [ ] Summary cards show total, NDA, and MSA counts
- [ ] Contract list displays all user contracts
- [ ] List is sortable by name, type, status, date
- [ ] Click row navigates to results page
- [ ] "Review a Contract" button navigates to upload
- [ ] Status badges color-coded correctly
- [ ] Dates shown as relative time (e.g., "2 days ago")
- [ ] Loading state shown while fetching
- [ ] Only user's own contracts are visible (RLS)
