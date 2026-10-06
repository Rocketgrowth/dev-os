import { createClient } from '@/lib/supabase/server'
import { signUpSchema } from '@/lib/validation/schemas'
import { checkRateLimit, createRateLimitResponse } from '@/lib/security/rateLimiter'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = signUpSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
        { status: 422 }
      )
    }

    // Rate limit by email to prevent abuse
    const identifier = `auth:${parsed.data.email.toLowerCase()}`
    const rateLimitResult = await checkRateLimit(identifier, 'auth')
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    })

    if (error) {
      const status = error.message.toLowerCase().includes('already registered')
        ? 409
        : 400
      return NextResponse.json(
        { error: error.message, code: status === 409 ? 'EMAIL_EXISTS' : 'SIGNUP_FAILED' },
        { status }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Failed to create user', code: 'USER_CREATION_FAILED' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
