/**
 * Supabase-based Rate Limiter
 *
 * Uses a sliding window algorithm with a Supabase table.
 * All operations use the admin client (service role) so users
 * cannot manipulate their own rate limit counts.
 *
 * For authenticated endpoints: uses user_id (UUID)
 * For auth endpoints: uses IP-based or email-based in-memory fallback
 */

import { createAdminClient } from '@/lib/supabase/admin'

// Rate limit configurations
export const RATE_LIMITS = {
  // Authentication endpoints - 10 requests per minute
  auth: { limit: 10, windowSeconds: 60 },

  // Chat endpoint - 30 requests per minute
  chat: { limit: 30, windowSeconds: 60 },

  // Contract processing - 5 requests per hour
  process: { limit: 5, windowSeconds: 3600 },

  // File upload - 20 uploads per day
  upload: { limit: 20, windowSeconds: 86400 },

  // Default for other endpoints - 60 requests per minute
  default: { limit: 60, windowSeconds: 60 },
} as const

export type RateLimitAction = keyof typeof RATE_LIMITS

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: Date
  retryAfterSeconds?: number
}

// In-memory store for pre-auth rate limiting (email/IP based)
// This is a fallback for endpoints where the user isn't authenticated yet
interface MemoryRateLimitEntry {
  count: number
  windowStart: number
}

const memoryStore = new Map<string, MemoryRateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryStore.entries()) {
    const maxWindow = Math.max(...Object.values(RATE_LIMITS).map(r => r.windowSeconds)) * 1000
    if (now - entry.windowStart > maxWindow) {
      memoryStore.delete(key)
    }
  }
}, 60 * 1000).unref()

/**
 * Check rate limit using in-memory store.
 * Used for auth endpoints before user is authenticated.
 */
function checkMemoryRateLimit(
  identifier: string,
  action: RateLimitAction
): RateLimitResult {
  const config = RATE_LIMITS[action]
  const now = Date.now()
  const key = `${action}:${identifier}`

  let entry = memoryStore.get(key)

  // Reset window if expired
  if (!entry || now - entry.windowStart > config.windowSeconds * 1000) {
    entry = { count: 0, windowStart: now }
  }

  entry.count++
  memoryStore.set(key, entry)

  const resetTime = new Date(entry.windowStart + config.windowSeconds * 1000)
  const remaining = Math.max(0, config.limit - entry.count)
  const success = entry.count <= config.limit

  if (!success) {
    const retryAfterSeconds = Math.ceil((resetTime.getTime() - now) / 1000)
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetTime,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    }
  }

  return {
    success: true,
    limit: config.limit,
    remaining,
    resetTime,
  }
}

/**
 * Check if an identifier is a valid UUID
 */
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Check and record a rate limit event.
 * Uses Supabase with service role to prevent user manipulation.
 *
 * For authenticated users (UUID identifiers): uses Supabase table
 * For pre-auth (email/IP identifiers): uses in-memory fallback
 *
 * @param identifier - The user's ID (UUID) or email/IP for pre-auth
 * @param action - The action being rate limited
 * @returns RateLimitResult with success status and limit info
 */
export async function checkRateLimit(
  identifier: string,
  action: RateLimitAction = 'default'
): Promise<RateLimitResult> {
  // For non-UUID identifiers (pre-auth), use in-memory rate limiting
  if (!isUUID(identifier)) {
    return checkMemoryRateLimit(identifier, action)
  }

  const config = RATE_LIMITS[action]
  const supabase = createAdminClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowSeconds * 1000)

  // Count events in the current window
  const { count, error: countError } = await supabase
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', identifier)
    .eq('action', action)
    .gte('created_at', windowStart.toISOString())

  if (countError) {
    console.error('Rate limit count error:', countError)
    // On error, allow the request but log it
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit,
      resetTime: new Date(now.getTime() + config.windowSeconds * 1000),
    }
  }

  const currentCount = count || 0
  const remaining = Math.max(0, config.limit - currentCount - 1)
  const resetTime = new Date(now.getTime() + config.windowSeconds * 1000)

  // If limit exceeded, don't record event and return failure
  if (currentCount >= config.limit) {
    // Find the oldest event to calculate retry time
    const { data: oldestEvent } = await supabase
      .from('rate_limit_events')
      .select('created_at')
      .eq('user_id', identifier)
      .eq('action', action)
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    let retryAfterSeconds: number = config.windowSeconds

    if (oldestEvent) {
      const oldestTime = new Date(oldestEvent.created_at).getTime()
      const windowEndTime = oldestTime + config.windowSeconds * 1000
      retryAfterSeconds = Math.ceil((windowEndTime - now.getTime()) / 1000)
    }

    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetTime,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    }
  }

  // Record the event
  const { error: insertError } = await supabase
    .from('rate_limit_events')
    .insert({
      user_id: identifier,
      action,
    })

  if (insertError) {
    console.error('Rate limit insert error:', insertError)
    // Still allow the request if we can't record it
  }

  return {
    success: true,
    limit: config.limit,
    remaining,
    resetTime,
  }
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime.getTime() / 1000)),
  }

  if (!result.success && result.retryAfterSeconds) {
    headers['Retry-After'] = String(result.retryAfterSeconds)
  }

  return headers
}

/**
 * Create a rate limit exceeded response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: `Rate limit exceeded. Please try again in ${result.retryAfterSeconds || 60} seconds.`,
      code: 'RATE_LIMITED',
      retryAfter: result.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...getRateLimitHeaders(result),
      },
    }
  )
}

/**
 * Clean up old rate limit events (call periodically via cron)
 * Deletes events older than 24 hours
 */
export async function cleanupOldEvents(): Promise<void> {
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const { error } = await supabase
    .from('rate_limit_events')
    .delete()
    .lt('created_at', cutoff.toISOString())

  if (error) {
    console.error('Rate limit cleanup error:', error)
  }
}
