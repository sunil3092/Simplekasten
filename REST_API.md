# Simplekasten REST API Documentation

## Overview

Simplekasten has migrated from tRPC to a standard REST API. This document explains the API structure, endpoints, and authentication.

**Base URL:**

- Local: `http://localhost:4000`
- Production: `https://api.simplekasten.com`

## Authentication

All protected endpoints require a **JWT Bearer token** in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Token Lifecycle

1. **Login/Register** → Get `accessToken` (15 min TTL) and `refreshToken` (30 day TTL)
2. **Store tokens** → Save both in session/localStorage
3. **Send requests** → Use `accessToken` in `Authorization` header
4. **Token expires** → Frontend automatically calls `/api/auth/refresh`
5. **Get new tokens** → Server rotates the refresh token for security

### Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password."
  }
}
```

Common error codes:

- `UNAUTHORIZED` (401) — Missing or invalid token
- `FORBIDDEN` (403) — Insufficient permissions
- `NOT_FOUND` (404) — Resource doesn't exist
- `CONFLICT` (409) — Resource already exists
- `BAD_REQUEST` (400) — Invalid input
- `INTERNAL_SERVER_ERROR` (500) — Server error

---

## API Endpoints

### Authentication

#### POST `/api/auth/register`

Register a new user.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "displayName": "John Doe"
}
```

**Response (201):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a3f5d2e9c1b8...",
  "userId": "user-123"
}
```

---

#### POST `/api/auth/login`

Login with email and password.

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
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "a3f5d2e9c1b8...",
  "userId": "user-123"
}
```

**Errors:**

- `401 UNAUTHORIZED` — Invalid email or password

---

#### POST `/api/auth/refresh`

Refresh an expired access token.

**Request:**

```json
{
  "refreshToken": "a3f5d2e9c1b8..."
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "b4g6e3f9d2c9...",
  "userId": "user-123"
}
```

**Errors:**

- `401 UNAUTHORIZED` — Refresh token expired or revoked

---

#### POST `/api/auth/logout`

Logout and revoke the refresh token.

**Request:**

```json
{
  "refreshToken": "a3f5d2e9c1b8..."
}
```

**Response (200):**

```json
{
  "ok": true
}
```

---

### Notes

#### GET `/api/notes?kbId={kbId}&tag={tag}`

List all notes in a knowledge base, optionally filtered by tag.

**Query Parameters:**

- `kbId` (required) — Knowledge base ID
- `tag` (optional) — Filter by tag name

**Headers:**

```
Authorization: Bearer {accessToken}
```

**Response (200):**

```json
[
  {
    "id": "note-123",
    "kbId": "kb-456",
    "zettelId": "3a1",
    "title": "My First Note",
    "type": "permanent",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
]
```

---

#### GET `/api/notes/search?kbId={kbId}&query={query}`

Full-text search notes.

**Query Parameters:**

- `kbId` (required) — Knowledge base ID
- `query` (required) — Search query (1-200 chars)

**Response (200):**

```json
[
  {
    "id": "note-123",
    "zettelId": "3a1",
    "title": "My First Note",
    "type": "permanent",
    "snippet": "This is a <snippet> from the matching note..."
  }
]
```

---

#### GET `/api/notes/{id}`

Get full note details including backlinks and attachments.

**Path Parameters:**

- `id` — Note ID

**Response (200):**

```json
{
  "id": "note-123",
  "kbId": "kb-456",
  "zettelId": "3a1",
  "title": "My First Note",
  "content": "# My Note\n\nThis is a [[3a2]] link.",
  "type": "permanent",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",
  "tagNames": ["important", "research"],
  "backlinks": [
    {
      "noteId": "note-789",
      "title": "Related Note",
      "zettelId": "3a3",
      "context": "This note [[3a1]] links back..."
    }
  ],
  "contents": [
    {
      "noteId": "note-999",
      "title": "Linked Note",
      "zettelId": "3a2",
      "resolved": true
    }
  ],
  "attachments": [
    {
      "id": "att-111",
      "kind": "image",
      "mimeType": "image/png",
      "size": 102400,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Errors:**

- `404 NOT_FOUND` — Note not found

---

#### POST `/api/notes`

Create a new note.

**Request:**

```json
{
  "kbId": "kb-456",
  "title": "New Note",
  "content": "Note content in markdown",
  "type": "permanent"
}
```

**Response (201):**

```json
{
  "id": "note-123",
  "kbId": "kb-456",
  "zettelId": "3a1",
  "title": "New Note",
  "content": "Note content in markdown",
  "type": "permanent",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

---

#### PUT `/api/notes/{id}`

Update a note.

**Request:**

```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "type": "literature"
}
```

**Response (200):**

```json
{
  "id": "note-123",
  "kbId": "kb-456",
  "zettelId": "3a1",
  "title": "Updated Title",
  "content": "Updated content",
  "type": "literature",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

---

#### DELETE `/api/notes/{id}`

Soft-delete a note (marks deletedAt timestamp).

**Response (200):**

```json
{
  "id": "note-123"
}
```

---

#### GET `/api/notes/{kbId}/graph`

Get graph data (nodes and edges) for visualization.

**Response (200):**

```json
{
  "nodes": [
    {
      "id": "note-123",
      "title": "My Note",
      "zettelId": "3a1",
      "type": "permanent"
    }
  ],
  "edges": [
    {
      "source": "note-123",
      "target": "note-456"
    }
  ]
}
```

---

### Tags

#### GET `/api/tags?kbId={kbId}`

List all tags in a knowledge base.

**Query Parameters:**

- `kbId` (required) — Knowledge base ID

**Response (200):**

```json
[
  {
    "id": "tag-123",
    "name": "important",
    "noteCount": 42
  }
]
```

---

### Vaults (Knowledge Bases)

#### GET `/api/vaults`

List all knowledge bases for the current user.

**Response (200):**

```json
[
  {
    "id": "kb-456",
    "ownerId": "user-123",
    "name": "My Vault",
    "slug": "my-vault",
    "isDefault": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

---

#### POST `/api/vaults`

Create a new knowledge base.

**Request:**

```json
{
  "name": "Research Notes"
}
```

**Response (201):**

```json
{
  "id": "kb-789",
  "ownerId": "user-123",
  "name": "Research Notes",
  "slug": "research-notes",
  "isDefault": false,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

---

### Attachments

#### GET `/api/attachments?noteId={noteId}`

List attachments for a note.

**Query Parameters:**

- `noteId` (required) — Note ID

**Response (200):**

```json
[
  {
    "id": "att-111",
    "kind": "image",
    "mimeType": "image/png",
    "size": 102400,
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

---

#### DELETE `/api/attachments/{id}`

Delete an attachment.

**Response (200):**

```json
{
  "id": "att-111"
}
```

---

## Usage Examples

### JavaScript/TypeScript (Frontend)

```typescript
import { api } from "@/lib/api";

// Login
const tokens = await api.auth.login("user@example.com", "password");
localStorage.setItem("accessToken", tokens.accessToken);
localStorage.setItem("refreshToken", tokens.refreshToken);

// Create a note
const note = await api.notes.create({
  kbId: "kb-456",
  title: "My Note",
  content: "# Heading\n\nContent here",
  type: "permanent",
});

// Search notes
const results = await api.notes.search("kb-456", "important");

// Get full note details
const noteDetails = await api.notes.getById("note-123");
```

### cURL (Command Line)

```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Create note
curl -X POST http://localhost:4000/api/notes \
  -H "Authorization: Bearer eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{
    "kbId": "kb-456",
    "title": "My Note",
    "content": "Content",
    "type": "permanent"
  }'

# List notes
curl http://localhost:4000/api/notes?kbId=kb-456 \
  -H "Authorization: Bearer eyJhbGci..."
```

### Python

```python
import requests
import json

API_URL = "http://localhost:4000"

# Login
response = requests.post(f"{API_URL}/api/auth/login", json={
    "email": "user@example.com",
    "password": "password"
})
data = response.json()
access_token = data["accessToken"]

# Create note
headers = {"Authorization": f"Bearer {access_token}"}
response = requests.post(f"{API_URL}/api/notes",
    headers=headers,
    json={
        "kbId": "kb-456",
        "title": "My Note",
        "content": "Content",
        "type": "permanent"
    }
)
print(response.json())
```

---

## OpenAPI/Swagger

The full OpenAPI 3.0 specification is available at `apps/api/src/openapi.ts`.

To view the interactive Swagger UI (when deployed with Swagger UI):

- Local: `http://localhost:4000/docs`
- Production: `https://api.simplekasten.com/docs`

---

## Migration Notes

### From tRPC to REST

If you're migrating from the old tRPC client:

**Before (tRPC):**

```typescript
const note = await trpc.note.getById.query({ id: "note-123" });
```

**After (REST):**

```typescript
const note = await api.notes.getById("note-123");
```

The REST client (`/lib/api.ts`) wraps fetch with:

- Automatic token refresh on 401
- Error handling
- Request/response transformation

### Why REST?

- ✅ **Language-agnostic** — Any language/platform can consume the API
- ✅ **Independently deployable** — API and frontend can scale separately
- ✅ **Standard tooling** — OpenAPI, Swagger, standard HTTP tools
- ✅ **Better for teams** — Easier for external developers to integrate

---

## Rate Limiting

Currently no rate limits. Production deployment should implement:

- Per-user request throttling
- Search query rate limiting
- Authentication endpoint brute-force protection

---

## Support

For issues or questions:

1. Check the OpenAPI spec (`openapi.ts`)
2. Review the test suite (`*.test.ts`, `*.integration.test.ts`)
3. Open an issue on GitHub
