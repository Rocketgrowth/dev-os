# Authentication Specification

## Overview

ContractIQ uses Supabase Auth for email/password authentication. All contract data is isolated per user via Row Level Security (RLS).

---

## User Flows

### Flow 1: Sign Up

```
1. User navigates to /signup
2. User enters email and password (min 8 characters)
3. Frontend validates input with Zod schema
4. Frontend calls supabase.auth.signUp({ email, password })
5. Supabase creates user in auth.users
6. Supabase returns session with access_token
7. Frontend stores session in cookies (handled by @supabase/ssr)
8. Frontend redirects to /dashboard
9. Dashboard renders empty state
```

### Flow 2: Sign In

```
1. User navigates to /login
2. User enters email and password
3. Frontend validates input with Zod schema
4. Frontend calls supabase.auth.signInWithPassword({ email, password })
5. Supabase validates credentials
6. Supabase returns session with access_token
7. Frontend stores session in cookies
8. Frontend redirects to /dashboard
9. Dashboard renders contract list (if any)
```

### Flow 3: Sign Out

```
1. User clicks "Sign Out" in user menu
2. Frontend calls supabase.auth.signOut()
3. Supabase invalidates session
4. Frontend clears cookies
5. Frontend redirects to /login
```

### Flow 4: Session Refresh

```
1. User has valid session cookie
2. Session expires (default: 1 hour)
3. @supabase/ssr middleware intercepts request
4. Middleware calls supabase.auth.getSession()
5. Supabase refreshes token using refresh_token
6. New session stored in cookies
7. Request continues with valid session
```

---

## Implementation

### Files to Create

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser-side Supabase client |
| `src/lib/supabase/server.ts` | Server-side Supabase client (API routes) |
| `src/lib/supabase/middleware.ts` | Auth middleware for session refresh |
| `src/middleware.ts` | Next.js middleware for route protection |
| `src/hooks/use-auth.ts` | React hook for auth state |
| `src/app/(auth)/login/page.tsx` | Sign in page |
| `src/app/(auth)/signup/page.tsx` | Sign up page |
| `src/app/(auth)/layout.tsx` | Auth pages layout (centered card) |
| `src/components/auth/auth-form.tsx` | Reusable auth form component |
| `src/components/auth/user-menu.tsx` | User dropdown with sign out |

---

### `src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

### `src/lib/supabase/server.ts`

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - ignore
          }
        },
      },
    }
  )
}
```

---

### `src/middleware.ts`

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/dashboard', '/upload', '/contracts']
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from auth pages
  const authPaths = ['/login', '/signup']
  const isAuthPath = authPaths.some((path) =>
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

### `src/hooks/use-auth.ts`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, loading, signOut }
}
```

---

## Validation Schemas

### `src/lib/validation/auth-schemas.ts`

```typescript
import { z } from 'zod'

export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
```

---

## Error Handling

| Supabase Error | User Message |
|----------------|--------------|
| `invalid_credentials` | "Invalid email or password" |
| `email_not_confirmed` | "Please verify your email before signing in" |
| `user_already_exists` | "An account with this email already exists" |
| `weak_password` | "Password is too weak. Use at least 8 characters" |
| Network error | "Unable to connect. Please check your internet connection" |

---

## Security Considerations

1. **Password Requirements**: Minimum 8 characters (Supabase default)
2. **Session Duration**: 1 hour access token, 7 day refresh token (Supabase defaults)
3. **CSRF Protection**: Handled by Supabase SSR cookie handling
4. **RLS Enforcement**: All database queries use `auth.uid()` for row isolation
5. **Service Role Key**: Never exposed to client; only used in server API routes

---

## Acceptance Criteria

- [ ] User can create account with valid email and password
- [ ] User sees validation errors for invalid input
- [ ] User can sign in with existing credentials
- [ ] Invalid credentials show clear error message
- [ ] User can sign out and session is cleared
- [ ] Auth state persists across page refreshes
- [ ] Protected routes redirect to /login when unauthenticated
- [ ] Auth pages redirect to /dashboard when authenticated
- [ ] Session refreshes automatically before expiry
