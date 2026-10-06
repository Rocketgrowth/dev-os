import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

export interface AuthResult {
  user: User
  supabase: Awaited<ReturnType<typeof createClient>>
}

export interface AuthError {
  response: NextResponse
}

/**
 * Verifies the user session and returns the authenticated user.
 * Returns a 401 response if the user is not authenticated.
 *
 * Usage:
 * ```ts
 * const auth = await requireAuth()
 * if ('response' in auth) {
 *   return auth.response
 * }
 * const { user, supabase } = auth
 * ```
 */
export async function requireAuth(): Promise<AuthResult | AuthError> {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          code: 'UNAUTHORIZED'
        },
        { status: 401 }
      )
    }
  }

  return { user, supabase }
}

/**
 * Type guard to check if auth result is an error
 */
export function isAuthError(result: AuthResult | AuthError): result is AuthError {
  return 'response' in result
}
