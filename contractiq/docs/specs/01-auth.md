# Authentication Specification

## Overview

ContractIQ uses Supabase Auth for email/password authentication. All protected routes require a valid session. User data is isolated via Row Level Security (RLS).

---

## User Flow

### Sign Up

```
1. User navigates to /signup
2. User enters email and password (min 8 characters)
3. Frontend validates input with Zod schema
4. Frontend calls POST /api/auth/signup
5. API route calls Supabase Auth signUp()
6. On success: redirect to /dashboard
7. On error: display error message (invalid email, weak password, email taken)
```

### Sign In

```
1. User navigates to /login
2. User enters email and password
3. Frontend validates input with Zod schema
4. Frontend calls POST /api/auth/login
5. API route calls Supabase Auth signInWithPassword()
6. Supabase sets session cookie
7. On success: redirect to /dashboard
8. On error: display "Invalid credentials" message
```

### Sign Out

```
1. User clicks "Sign Out" in user menu
2. Frontend calls POST /api/auth/logout
3. API route calls Supabase Auth signOut()
4. Session cookie cleared
5. Redirect to /login
```

### Session Persistence

```
1. On page load, Supabase client checks for valid session cookie
2. If valid: user remains authenticated
3. If expired: Supabase attempts token refresh
4. If refresh fails: redirect to /login
```

---

## API Routes

### POST /api/auth/signup

**File:** `app/api/auth/signup/route.ts`

**Request Body:**
```typescript
{
  email: string // Valid email format
  password: string // Min 8 characters
}
```

**Validation Schema:**
```typescript
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
```

**Success Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

**Error Responses:**
- 400: Invalid email or password format
- 409: Email already registered

**Implementation:**
```typescript
import { createClient } from '@/lib/supabase/server'
import { signupSchema } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = signupSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    const status = error.message.includes('already registered') ? 409 : 400
    return Response.json({ error: error.message }, { status })
  }

  return Response.json({ user: data.user }, { status: 201 })
}
```

### POST /api/auth/login

**File:** `app/api/auth/login/route.ts`

**Request Body:**
```typescript
{
  email: string
  password: string
}
```

**Validation Schema:**
```typescript
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
```

**Success Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

**Error Responses:**
- 401: Invalid credentials

**Implementation:**
```typescript
import { createClient } from '@/lib/supabase/server'
import { loginSchema } from '@/lib/validation/schemas'

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  return Response.json({ user: data.user })
}
```

### POST /api/auth/logout

**File:** `app/api/auth/logout/route.ts`

**Success Response (200):**
```json
{
  "success": true
}
```

**Implementation:**
```typescript
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  return Response.json({ success: true })
}
```

---

## Frontend Components

### AuthForm Component

**File:** `components/auth/auth-form.tsx`

**Props:**
```typescript
interface AuthFormProps {
  mode: 'login' | 'signup'
}
```

**Features:**
- Shared form for login and signup
- React Hook Form for form state
- Zod validation
- Error message display
- Loading state during submission
- Link to switch between login/signup

### UserMenu Component

**File:** `components/auth/user-menu.tsx`

**Features:**
- Dropdown menu with user email
- Sign out button
- Uses Radix UI DropdownMenu via shadcn/ui

---

## Hooks

### useAuth Hook

**File:** `hooks/use-auth.ts`

**Returns:**
```typescript
{
  user: User | null
  isLoading: boolean
  signOut: () => Promise<void>
}
```

**Implementation:**
```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return { user, isLoading, signOut }
}
```

---

## Middleware

**File:** `middleware.ts`

**Purpose:** Protect dashboard routes, redirect unauthenticated users to login

**Implementation:**
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/dashboard', '/upload', '/contracts']
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  const authPaths = ['/login', '/signup']
  const isAuthPath = authPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Weak password | Zod validation rejects passwords < 8 chars |
| Invalid email format | Zod validation rejects invalid emails |
| Duplicate email | Supabase returns error, display "Email already registered" |
| Session expired | Supabase auto-refreshes; if fails, redirect to /login |
| Network error | Display toast with retry option |
| Concurrent sessions | Allowed (same account on multiple devices) |

---

## Acceptance Criteria

- [ ] User can create account with email and password (min 8 chars)
- [ ] User can sign in with valid credentials
- [ ] Invalid credentials show clear error message
- [ ] User can sign out and session is cleared
- [ ] Auth state persists across page refreshes
- [ ] Protected routes redirect to /login when unauthenticated
- [ ] Auth pages redirect to /dashboard when authenticated
