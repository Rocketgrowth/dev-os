# ContractIQ Security Plan

This document describes all security controls implemented for ContractIQ, including authentication, authorization, input validation, rate limiting, and prompt injection protection.

---

## Table of Contents

1. [Security Overview](#security-overview)
2. [Authentication & Protected Routes](#authentication--protected-routes)
3. [API Request Validation](#api-request-validation)
4. [Rate Limiting](#rate-limiting)
5. [Prompt Injection Protection](#prompt-injection-protection)
6. [Token & Usage Limits](#token--usage-limits)
7. [Chat Security](#chat-security)
8. [File Upload Security](#file-upload-security)
9. [Environment Variable Security](#environment-variable-security)
10. [Row Level Security (RLS)](#row-level-security-rls)
11. [Security Issues Found & Fixed](#security-issues-found--fixed)
12. [Files Created & Modified](#files-created--modified)
13. [Outstanding Items](#outstanding-items)

---

## Security Overview

ContractIQ implements defense-in-depth security with multiple layers:

| Layer | Control | Implementation |
|-------|---------|----------------|
| Edge | Route protection | Next.js middleware |
| API | Authentication | `requireAuth()` helper |
| API | Rate limiting | Supabase-based sliding window |
| API | Input validation | Zod schemas |
| AI | Prompt injection | `sanitizeForLLM()` guard |
| Database | Row isolation | RLS policies |
| Storage | File isolation | Private buckets + signed URLs |

---

## Authentication & Protected Routes

### Implementation

**File:** `middleware.ts`

Protected routes that require authentication:
- `/dashboard`
- `/upload`
- `/contracts`
- `/chat`
- `/settings`
- `/profile`

Auth routes that redirect authenticated users to dashboard:
- `/login`
- `/signup`

### Session Management

- Supabase Auth handles session management
- Sessions are stored in HTTP-only cookies
- Automatic session refresh via middleware
- Refresh token rotation enabled in Supabase

### Auth Flow

1. User submits credentials to `/api/auth/login`
2. Server validates with Supabase Auth
3. Session cookie set automatically via `@supabase/ssr`
4. Middleware checks session on protected routes
5. Invalid sessions redirect to `/login`

### Auth Helper

**File:** `lib/security/authGuard.ts`

```typescript
const auth = await requireAuth()
if (isAuthError(auth)) {
  return auth.response
}
const { user, supabase } = auth
```

---

## API Request Validation

### Implementation

**File:** `lib/security/inputValidator.ts`

All API routes validate request bodies using Zod schemas. Invalid requests are rejected with `422 VALIDATION_ERROR` before any business logic executes.

### Schemas

| Schema | Purpose |
|--------|---------|
| `signUpSchema` | Email + password validation |
| `signInSchema` | Login credentials |
| `uploadContractSchema` | Contract name, type, custom terms |
| `sendMessageSchema` | Chat message (max 5000 chars) |
| `createFeedbackSchema` | Rating + optional comment |
| `updateKeyTermSchema` | Term value editing |

### Validation Pattern

```typescript
const parsed = sendMessageSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json(
    { error: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' },
    { status: 422 }
  )
}
```

---

## Rate Limiting

### Implementation

**File:** `lib/security/rateLimiter.ts`
**Table:** `rate_limit_events`

Rate limiting uses a Supabase-based sliding window algorithm. All operations use the admin client (service role) so users cannot manipulate their own counts.

### Limits

| Endpoint | Limit |
|----------|-------|
| Authentication | 10 requests / minute |
| Chat | 30 requests / minute |
| Contract processing | 5 requests / hour |
| File upload | 20 uploads / day |
| Default | 60 requests / minute |

### Response

When rate limited, the API returns:
- Status: `429 Too Many Requests`
- Header: `Retry-After: <seconds>`
- Body: `{ error: "...", code: "RATE_LIMITED", retryAfter: <seconds> }`

### Database Table

```sql
CREATE TABLE rate_limit_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

No RLS policies exist for this table—only the service role can access it.

---

## Prompt Injection Protection

### Implementation

**File:** `lib/security/promptInjectionGuard.ts`

All user messages are sanitized before being sent to the LLM. If injection patterns are detected, the request is rejected with `400 PROMPT_INJECTION`.

### Detected Patterns

**System Prompt Manipulation:**
- "ignore previous instructions"
- "override your rules"
- "new instructions:"

**Role Manipulation:**
- "you are now a..."
- "act as..."
- "pretend you are..."

**Secrets Extraction:**
- "reveal system prompt"
- "show API keys"
- "expose env variables"

**Jailbreak Attempts:**
- "jailbreak"
- "DAN mode"
- "developer mode"
- "bypass safety filters"

### Usage

```typescript
const sanitization = sanitizeForLLM(userMessage)
if (!sanitization.safe) {
  return createPromptInjectionResponse()
}
// Use sanitization.sanitized
```

### Rules

1. Instructions embedded inside contract text are ignored by the system prompt
2. Internal prompts, environment variables, and database contents are never exposed
3. The AI is instructed to only answer from the contract text

---

## Token & Usage Limits

### Implementation

**File:** `lib/security/tokenLimiter.ts`

### Limits

| Limit | Value | Env Override |
|-------|-------|--------------|
| Max file size | 10 MB | `MAX_FILE_SIZE_MB` |
| Max page count | 200 pages | `MAX_PAGE_COUNT` |
| Max message length | 5000 characters | — |
| Max chat history sent to model | 100 messages | `MAX_CHAT_HISTORY` |

### Validators

```typescript
validateFileSize(sizeBytes)
validatePageCount(pageCount)
validateMessageLength(message)
truncateChatHistory(messages)
```

---

## Chat Security

### Implementation

**File:** `lib/security/chatSecurity.ts`

Before every chat request, the API verifies:
1. **Contract ownership:** `contract.user_id === auth.uid()`
2. **Session ownership:** The chat session belongs to the user's contract
3. **Contract status:** `status === 'completed'` (chat only allowed after processing)
4. **Contract text:** Text is available for the AI to reference

### Rejection Behavior

If any check fails, the API returns `404 NOT_FOUND` to avoid revealing whether the resource exists.

### Usage

```typescript
const access = await verifyChatAccess(supabase, contractId, user.id)
if (!access.valid) {
  return access.error
}
const { contract } = access
```

---

## File Upload Security

### Implementation

**File:** `lib/security/inputValidator.ts`

### Validation Order

1. **Extension check** (blocklist → allowlist)
2. **MIME type validation**
3. **Magic bytes verification**
4. **File size enforcement**

### Allowed Types

| Extension | MIME Type |
|-----------|-----------|
| `.pdf` | `application/pdf` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

### Blocked Extensions

`.exe`, `.js`, `.mjs`, `.cjs`, `.php`, `.zip`, `.sh`, `.bat`, `.cmd`, `.py`, `.rb`, `.ps1`, `.vbs`, `.jar`, `.msi`, `.dll`, `.so`

### Storage Security

- Files stored in **private** Supabase bucket
- Access via **signed URLs** only
- URLs expire after **1 hour**
- Path structure: `{user_id}/{contract_id}/{filename}`

---

## Environment Variable Security

### Server-Only Variables (Never expose to client)

```
OPENAI_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Public Variables (Safe for client)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL
```

### Rules

1. Never log any secret
2. `SUPABASE_SERVICE_ROLE_KEY` only used inside `createAdminClient()`
3. Server-side variables have no `NEXT_PUBLIC_` prefix
4. All secrets documented in `.env.example`

---

## Row Level Security (RLS)

### Implementation

**File:** `supabase/rls-policies.sql`

All tables have RLS enabled with user isolation:

| Table | Policy |
|-------|--------|
| `contracts` | Users can only CRUD their own contracts |
| `key_terms` | Access via contract ownership |
| `custom_key_terms` | Access via contract ownership |
| `chat_sessions` | Access via contract ownership |
| `chat_messages` | Access via session → contract ownership |
| `user_feedback` | Access via contract ownership |
| `rate_limit_events` | No user policies (service role only) |

### Verification Query

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public';
```

---

## Security Issues Found & Fixed

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | In-memory rate limiting doesn't persist across serverless instances | High | Replaced with Supabase-based rate limiting |
| 2 | No rate limiting on auth routes | High | Added 10 req/min limit on login/signup |
| 3 | Chat allowed on contracts not yet processed | Medium | Added `status === 'completed'` check |
| 4 | No prompt injection detection | High | Added `sanitizeForLLM()` guard |
| 5 | Missing protected routes in middleware | Medium | Added `/chat`, `/settings`, `/profile` |
| 6 | File upload only checks PDF, not DOCX | Low | Added DOCX support |
| 7 | No magic bytes validation | Medium | Added file content verification |
| 8 | No admin client for bypassing RLS | Medium | Created `createAdminClient()` |
| 9 | Message length limit was 2000, should be 5000 | Low | Updated to 5000 |
| 10 | Missing `MAX_CHAT_HISTORY` env var | Low | Added to `.env.example` |

---

## Files Created & Modified

### Created

| File | Purpose |
|------|---------|
| `lib/security/authGuard.ts` | `requireAuth()` helper |
| `lib/security/rateLimiter.ts` | Supabase-based rate limiting |
| `lib/security/promptInjectionGuard.ts` | `sanitizeForLLM()` guard |
| `lib/security/tokenLimiter.ts` | Usage limit validators |
| `lib/security/chatSecurity.ts` | Contract/session ownership |
| `lib/security/inputValidator.ts` | File validation + Zod re-exports |
| `lib/security/index.ts` | Central export |
| `lib/supabase/admin.ts` | Service role client |
| `supabase/rls-policies.sql` | RLS policies + rate limit table |
| `docs/security/security-plan.md` | This document |

### Modified

| File | Change |
|------|--------|
| `middleware.ts` | Added `/chat`, `/settings`, `/profile` to protected routes |
| `.env.example` | Added `MAX_CHAT_HISTORY` |
| `app/api/auth/login/route.ts` | Added rate limiting |
| `app/api/auth/signup/route.ts` | Added rate limiting |
| `app/api/contracts/[id]/chat/route.ts` | Added prompt injection guard, status check |

---

## Outstanding Items

### Manual Setup Required

1. **Run RLS SQL**: Execute `supabase/rls-policies.sql` in the Supabase SQL Editor
2. **Create storage bucket**: Create a private "contracts" bucket with RLS
3. **Enable Supabase Auth settings**:
   - Email verification
   - Password reset flow
   - Session management
   - Refresh token rotation

### Future Improvements

1. **Audit logging**: Log security events (failed logins, rate limits, injection attempts)
2. **IP-based rate limiting**: Add fallback for unauthenticated requests
3. **CAPTCHA**: Add CAPTCHA to signup/login after failed attempts
4. **CSP headers**: Add Content Security Policy headers
5. **Security headers**: Add HSTS, X-Frame-Options, X-Content-Type-Options

---

## Environment Variables to Add

Add these to `.env.local`:

```bash
# Chat history limit (default: 100)
MAX_CHAT_HISTORY=100
```

---

## SQL to Run in Supabase

See `supabase/rls-policies.sql` for the complete script. Key additions:

```sql
-- Rate limit events table
CREATE TABLE IF NOT EXISTS rate_limit_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON rate_limit_events (user_id, action, created_at DESC);

ALTER TABLE rate_limit_events ENABLE ROW LEVEL SECURITY;
```
