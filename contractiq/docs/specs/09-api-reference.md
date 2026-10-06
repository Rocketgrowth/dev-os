# API Reference

## Overview

All API routes are implemented as Next.js Route Handlers in the `app/api/` directory. Protected endpoints require a valid Supabase session cookie.

---

## Authentication

Authentication is handled via Supabase Auth with session cookies. Protected endpoints return 401 if no valid session exists.

### Session Management

- Sessions are stored in HTTP-only cookies
- Supabase client automatically refreshes expired tokens
- Session validity is checked via middleware for protected routes

---

## Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/signup | No | Create new user account |
| POST | /api/auth/login | No | Sign in existing user |
| POST | /api/auth/logout | Yes | Sign out current user |
| GET | /api/contracts | Yes | List all user contracts |
| POST | /api/contracts/upload | Yes | Upload PDF and extract text |
| GET | /api/contracts/[id] | Yes | Get contract with terms |
| DELETE | /api/contracts/[id] | Yes | Delete contract |
| POST | /api/contracts/[id]/process | Yes | Run AI extraction |
| GET | /api/contracts/[id]/chat | Yes | Get chat history |
| POST | /api/contracts/[id]/chat | Yes | Send chat message |
| PATCH | /api/contracts/[id]/terms/[termId] | Yes | Edit key term |
| POST | /api/feedback | Yes | Submit feedback |

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

---

## Rate Limiting

AI-powered endpoints are rate limited:

| Endpoint | Limit |
|----------|-------|
| POST /api/contracts/[id]/process | 10 requests/minute/user |
| POST /api/contracts/[id]/chat | 10 requests/minute/user |

Rate limit exceeded returns:
```json
{
  "error": "Rate limit exceeded. Please try again later."
}
```

Status code: 429

---

## Detailed Endpoint Specifications

### POST /api/auth/signup

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

**Errors:**
- 400: Invalid email format
- 400: Password must be at least 8 characters
- 409: Email already registered

---

### POST /api/auth/login

Sign in an existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

**Errors:**
- 401: Invalid credentials

---

### POST /api/auth/logout

Sign out the current user.

**Response (200):**
```json
{
  "success": true
}
```

---

### GET /api/contracts

List all contracts for the authenticated user.

**Query Parameters:**
| Param | Type | Default | Options |
|-------|------|---------|---------|
| sort | string | created_at | created_at, name, type |
| order | string | desc | asc, desc |
| limit | number | 50 | 1-100 |
| offset | number | 0 | - |

**Response (200):**
```json
{
  "contracts": [
    {
      "id": "uuid",
      "name": "Vendor NDA.pdf",
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

---

### POST /api/contracts/upload

Upload a PDF contract and extract text.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | PDF file (max 10MB, 20 pages) |
| name | string | No | Contract name (defaults to filename) |
| type | string | Yes | "nda" or "msa" |
| customTerms | JSON array | No | Up to 5 custom term names |

**Response (201):**
```json
{
  "contract": {
    "id": "uuid",
    "name": "Vendor NDA.pdf",
    "type": "nda",
    "status": "pending",
    "page_count": 12,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Errors:**
- 400: Invalid file type (PDF only)
- 400: File size exceeds 10 MB
- 400: PDF exceeds 20 pages
- 400: Unable to extract text (scanned PDF)
- 400: Invalid contract type
- 400: Maximum 5 custom terms

---

### GET /api/contracts/[id]

Get a contract with all extracted terms.

**Response (200):**
```json
{
  "contract": {
    "id": "uuid",
    "name": "Vendor NDA.pdf",
    "type": "nda",
    "status": "completed",
    "contract_text": "...",
    "file_path": "user-id/contract-id/file.pdf",
    "file_url": "https://...signed-url...",
    "page_count": 12,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "terms": [
    {
      "id": "uuid",
      "term_name": "Governing Law",
      "value": "State of Delaware",
      "page_number": 4,
      "confidence_score": 0.92,
      "source_sentence": "This Agreement shall be governed...",
      "is_manual": false,
      "is_edited": false,
      "original_value": null
    }
  ]
}
```

**Errors:**
- 403: Forbidden (not owner)
- 404: Contract not found

---

### DELETE /api/contracts/[id]

Delete a contract and all associated data.

**Response (200):**
```json
{
  "success": true
}
```

**Errors:**
- 403: Forbidden (not owner)
- 404: Contract not found

---

### POST /api/contracts/[id]/process

Run AI key term extraction on a contract.

**Response (200):**
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
      "source_sentence": "...",
      "is_manual": false
    }
  ]
}
```

**Errors:**
- 400: Contract already processed
- 403: Forbidden (not owner)
- 404: Contract not found
- 500: AI extraction failed

---

### GET /api/contracts/[id]/chat

Get chat history for a contract.

**Response (200):**
```json
{
  "session": {
    "id": "uuid",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "What is the NDA duration?",
      "page_citation": null,
      "created_at": "2024-01-15T10:32:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "Based on the document, the NDA has a duration of 24 months. [Page 3]",
      "page_citation": 3,
      "created_at": "2024-01-15T10:32:05Z"
    }
  ]
}
```

---

### POST /api/contracts/[id]/chat

Send a chat message and get AI response.

**Request:**
```json
{
  "message": "What happens if I breach the NDA?"
}
```

**Response (200):**
```json
{
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Based on the document, a breach of confidentiality may result in... [Page 5]",
    "page_citation": 5,
    "created_at": "2024-01-15T10:35:00Z"
  }
}
```

**Errors:**
- 400: Message is required
- 400: Message too long (max 1000 chars)
- 403: Forbidden (not owner)
- 404: Contract not found
- 500: AI response failed

---

### PATCH /api/contracts/[id]/terms/[termId]

Edit an extracted key term value.

**Request:**
```json
{
  "value": "State of California"
}
```

**Response (200):**
```json
{
  "term": {
    "id": "uuid",
    "term_name": "Governing Law",
    "value": "State of California",
    "is_edited": true,
    "original_value": "State of Delaware"
  }
}
```

**Errors:**
- 400: Value is required
- 403: Forbidden (not owner)
- 404: Term not found

---

### POST /api/feedback

Submit feedback on a contract analysis.

**Request:**
```json
{
  "contract_id": "uuid",
  "rating": 1,
  "comment": "Very accurate extraction!"
}
```

**Response (201):**
```json
{
  "feedback": {
    "id": "uuid",
    "created_at": "2024-01-15T10:45:00Z"
  }
}
```

**Errors:**
- 400: Contract ID is required
- 400: Invalid rating (must be -1 or 1)
- 403: Forbidden (not owner)
- 404: Contract not found

---

## File Structure

```
app/api/
├── auth/
│   ├── signup/route.ts
│   ├── login/route.ts
│   └── logout/route.ts
├── contracts/
│   ├── route.ts              # GET (list)
│   ├── upload/route.ts       # POST (upload)
│   └── [id]/
│       ├── route.ts          # GET, DELETE
│       ├── process/route.ts  # POST
│       ├── chat/route.ts     # GET, POST
│       └── terms/
│           └── [termId]/route.ts  # PATCH
└── feedback/
    └── route.ts              # POST
```
