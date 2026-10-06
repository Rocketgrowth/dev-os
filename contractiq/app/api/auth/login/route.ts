import { createClient } from '@/lib/supabase/server'
import { signInSchema } from '@/lib/validation/schemas'
import { checkRateLimit, createRateLimitResponse } from '@/lib/security/rateLimiter'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = signInSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
        { status: 422 }
      )
    }

    // Rate limit by email to prevent brute force attacks
    // Use email hash as identifier since user isn't authenticated yet
    const identifier = `auth:${parsed.data.email.toLowerCase()}`
    const rateLimitResult = await checkRateLimit(identifier, 'auth')
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (error) {
      return NextResponse.json(
        { error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Authentication failed', code: 'AUTH_FAILED' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
