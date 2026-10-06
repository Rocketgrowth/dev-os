# API Routes Specification

## Overview

All API routes are implemented as Next.js Route Handlers in the `app/api/` directory. Authentication is handled via Supabase session cookies.

---

## Base URL

```
Development: http://localhost:3000/api
Production: https://contractiq.app/api
```

---

## Authentication

All protected endpoints require a valid Supabase session. The session is validated by calling `supabase.auth.getUser()` on each request.

**Error Response (401):**
```json
{
  "error": "Unauthorized"
}
```

---

## Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | No | Create new account |
| POST | `/api/auth/login` | No | Sign in |
| POST | `/api/auth/logout` | Yes | Sign out |
| GET | `/api/contracts` | Yes | List all contracts |
| POST | `/api/contracts/upload` | Yes | Upload and create contract |
| GET | `/api/contracts/[id]` | Yes | Get single contract |
| DELETE | `/api/contracts/[id]` | Yes | Delete contract |
| POST | `/api/contracts/[id]/process` | Yes | Run AI extraction |
| GET | `/api/contracts/[id]/chat` | Yes | Get chat history |
| POST | `/api/contracts/[id]/chat` | Yes | Send chat message |
| PATCH | `/api/contracts/[id]/terms/[termId]` | Yes | Update key term |
| POST | `/api/feedback` | Yes | Submit feedback |

---

## Auth Endpoints

### POST /api/auth/signup

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Validation:**
- `email`: Valid email format
- `password`: Minimum 8 characters

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
- `400`: Invalid email or password format
- `409`: Email already registered

---

### POST /api/auth/login

Sign in with existing credentials.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
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
- `401`: Invalid credentials

---

### POST /api/auth/logout

Sign out the current user.

**Success Response (200):**
```json
{
  "success": true
}
```

---

## Contract Endpoints

### GET /api/contracts

List all contracts for the authenticated user.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort` | string | `created_at` | Sort field: `name`, `type`, `status`, `created_at` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |
| `limit` | number | `50` | Max results (max: 100) |
| `offset` | number | `0` | Pagination offset |

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
      "created_at": "2024-08-15T10:30:00Z"
    }
  ],
  "total": 42
}
```

---

### POST /api/contracts/upload

Upload a PDF and create a contract record.

**Request Body:** `multipart/form-data`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF file (max 10MB, max 20 pages) |
| `name` | string | No | Contract name (defaults to filename) |
| `type` | string | Yes | `nda` or `msa` |
| `customTerms` | JSON | No | Array of custom term names (max 5) |

**Success Response (201):**
```json
{
  "contract": {
    "id": "uuid",
    "name": "Vendor NDA - Acme Corp",
    "type": "nda",
    "status": "pending",
    "page_count": 8,
    "created_at": "2024-08-15T10:30:00Z"
  }
}
```

**Error Responses:**
- `400`: Invalid file type, size, or page count
- `400`: Scanned PDF (extracted text < 100 words)

---

### GET /api/contracts/[id]

Get a single contract with all key terms.

**Success Response (200):**
```json
{
  "contract": {
    "id": "uuid",
    "name": "Vendor NDA - Acme Corp",
    "type": "nda",
    "status": "completed",
    "contract_text": "Full extracted text...",
    "file_path": "user_id/contract_id/file.pdf",
    "file_url": "https://signed-url...",
    "page_count": 8,
    "created_at": "2024-08-15T10:30:00Z"
  },
  "terms": [
    {
      "id": "uuid",
      "term_name": "Governing Law",
      "value": "State of Delaware",
      "page_number": 4,
      "confidence_score": 0.92,
      "source_sentence": "This Agreement shall be governed by...",
      "is_manual": false,
      "is_edited": false
    }
  ]
}
```

**Error Responses:**
- `404`: Contract not found
- `403`: Contract belongs to another user

---

### DELETE /api/contracts/[id]

Delete a contract and all associated data.

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- `404`: Contract not found
- `403`: Contract belongs to another user

---

### POST /api/contracts/[id]/process

Run AI key term extraction on a contract.

**Request Body:** None (uses stored contract_text)

**Success Response (200):**
```json
{
  "contract": {
    "id": "uuid",
    "status": "completed"
  },
  "terms": [
    {
      "id": "uuid",
      "term_name": "Governing Law",
      "value": "State of Delaware",
      "page_number": 4,
      "confidence_score": 0.92,
      "source_sentence": "This Agreement shall be governed by...",
      "is_manual": false
    }
  ]
}
```

**Error Responses:**
- `404`: Contract not found
- `403`: Contract belongs to another user
- `400`: Contract already processed
- `500`: OpenAI API error

---

### GET /api/contracts/[id]/chat

Get chat history for a contract.

**Success Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "created_at": "2024-08-15T10:35:00Z"
  },
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "What is the termination notice period?",
      "page_citation": null,
      "created_at": "2024-08-15T10:36:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "Based on the document, the termination notice period is 30 days. [Page 5]",
      "page_citation": 5,
      "created_at": "2024-08-15T10:36:05Z"
    }
  ]
}
```

---

### POST /api/contracts/[id]/chat

Send a chat message and get AI response.

**Request Body:**
```json
{
  "message": "What happens if I breach the NDA?"
}
```

**Validation:**
- `message`: 1-2000 characters

**Success Response (200):**
```json
{
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Based on the document, if you breach the NDA...",
    "page_citation": 6,
    "created_at": "2024-08-15T10:40:00Z"
  }
}
```

**Error Responses:**
- `404`: Contract not found
- `403`: Contract belongs to another user
- `500`: OpenAI API error

---

### PATCH /api/contracts/[id]/terms/[termId]

Update an extracted key term value.

**Request Body:**
```json
{
  "value": "Corrected value here"
}
```

**Success Response (200):**
```json
{
  "term": {
    "id": "uuid",
    "term_name": "Governing Law",
    "value": "Corrected value here",
    "is_edited": true,
    "original_value": "State of Delaware"
  }
}
```

**Error Responses:**
- `404`: Term not found
- `403`: Contract belongs to another user

---

## Feedback Endpoint

### POST /api/feedback

Submit feedback on a contract analysis.

**Request Body:**
```json
{
  "contract_id": "uuid",
  "rating": "1",
  "comment": "Great analysis, very helpful!"
}
```

**Validation:**
- `contract_id`: Valid UUID
- `rating`: `"1"` (thumbs up) or `"-1"` (thumbs down)
- `comment`: Optional, max 1000 characters

**Success Response (201):**
```json
{
  "feedback": {
    "id": "uuid",
    "created_at": "2024-08-15T11:00:00Z"
  }
}
```

**Error Responses:**
- `404`: Contract not found
- `403`: Contract belongs to another user
- `400`: Invalid rating value

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Human-readable error message"
}
```

---

## Rate Limiting

| Endpoint Pattern | Limit |
|------------------|-------|
| `/api/contracts/[id]/process` | 10 requests/minute/user |
| `/api/contracts/[id]/chat` | 10 requests/minute/user |
| `/api/contracts/upload` | 5 requests/minute/user |
| All other endpoints | 60 requests/minute/user |

**Rate Limit Exceeded (429):**
```json
{
  "error": "Rate limit exceeded. Please try again in 60 seconds."
}
```

---

## File Structure

```
src/app/api/
├── auth/
│   ├── signup/
│   │   └── route.ts
│   ├── login/
│   │   └── route.ts
│   └── logout/
│       └── route.ts
├── contracts/
│   ├── route.ts              # GET (list)
│   ├── upload/
│   │   └── route.ts          # POST (upload)
│   └── [id]/
│       ├── route.ts          # GET, DELETE (single)
│       ├── process/
│       │   └── route.ts      # POST (AI extraction)
│       ├── chat/
│       │   └── route.ts      # GET, POST (chat)
│       └── terms/
│           └── [termId]/
│               └── route.ts  # PATCH (edit term)
└── feedback/
    └── route.ts              # POST
```

---

## Acceptance Criteria

- [ ] All endpoints return correct status codes
- [ ] All endpoints validate input with Zod
- [ ] All protected endpoints verify authentication
- [ ] All endpoints verify resource ownership
- [ ] Error responses include helpful messages
- [ ] Rate limiting prevents abuse
- [ ] File uploads validate size and type
- [ ] Signed URLs expire after 1 hour
- [ ] OpenAI calls retry on failure
- [ ] Pagination works correctly
- [ ] Sorting works correctly
