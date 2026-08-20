# API reference

Base URL in development (via Vite proxy): `/api`  
Direct API (default): `http://localhost:3001/api`

All `/api` responses set:

- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`

JSON error bodies use `{ "error": "<message>" }` unless noted.

---

## `GET /api/health`

Health and persistence status.

**Response `200`**

```json
{
  "status": "ok",
  "persist": "ok",
  "uptime": 12.34
}
```

| Field | Values |
| --- | --- |
| `persist` | `ok` \| `degraded` \| `unavailable` |
| `status` | Same as `persist` when not `ok`; otherwise `ok` |
| `uptime` | `process.uptime()` in seconds |

---

## `GET /api/notes`

List all notes, newest `updatedAt` first.

**Response `200`** — array of notes:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Shopping",
    "body": "Milk",
    "createdAt": "2026-08-20T06:00:00.000Z",
    "updatedAt": "2026-08-20T06:05:00.000Z"
  }
]
```

**Errors**

| Status | When |
| --- | --- |
| `503` | Persist status is `unavailable` (data file could not be loaded) |

---

## `GET /api/notes/export`

Download all notes as an attachment.

**Query**

| Param | Required | Values | Default |
| --- | --- | --- | --- |
| `format` | no | `json`, `md`, `markdown` | `json` |

**Response `200`**

- Headers: `Content-Disposition: attachment; filename="notes-YYYY-MM-DD.<ext>"`
- `Content-Type`: `application/json; charset=utf-8` or `text/markdown; charset=utf-8`
- Body: export payload (see formats below)

**Errors**

| Status | Body |
| --- | --- |
| `400` | `{ "error": "format must be json or md" }` |
| `503` | Persist unavailable (same as list) |

### JSON export body

```json
{
  "exportedAt": "2026-08-20T06:41:00.000Z",
  "count": 1,
  "notes": [ /* Note[] */ ]
}
```

### Markdown export body

```markdown
# Notes

Exported: 2026-08-20T06:41:00.000Z
Count: 1

## Title

Body text

- id: `...`
- created: ...
- updated: ...
```

---

## `GET /api/notes/:id`

Fetch one note.

**Response `200`** — note object  
**Response `404`** — `{ "error": "note not found" }`  
**Response `503`** — persist unavailable

---

## `POST /api/notes`

Create a note.

**Request JSON**

```json
{ "title": "Required title", "body": "optional" }
```

- `title` required (non-empty after trim), max 200 characters
- `body` optional; non-string values become `""`; max 8000 characters after trim

**Response `201`** — created note (new UUID, `createdAt` === `updatedAt`)

**Errors**

| Status | Typical `error` |
| --- | --- |
| `400` | `title is required`, length messages, `invalid request body` |
| `413` | `request body too large` |
| `503` | disk write failure or refuse-overwrite when file is degraded/unavailable |

---

## `PUT /api/notes/:id`

Partial update. Omitted fields keep their current values. Sending neither
`title` nor `body` (or only `undefined`) is invalid.

**Request JSON**

```json
{ "title": "New title" }
```

or

```json
{ "body": "New body" }
```

or both. Unchanged content returns the existing note without bumping `updatedAt`.

**Response `200`** — updated note  
**Response `404`** — `{ "error": "note not found" }`  
**Response `400`** — validation (`title or body is required`, length limits, …)  
**Response `503`** — persist write refusal / failure

---

## `DELETE /api/notes/:id`

**Response `204`** — empty body  
**Response `404`** — `{ "error": "note not found" }`  
**Response `503`** — persist write refusal / failure

---

## Unknown `/api` routes

**Response `404`** — `{ "error": "not found" }`

---

## Note constraints (summary)

| Field | Rule |
| --- | --- |
| `title` | string, trimmed, required, ≤ 200 |
| `body` | string after normalize, ≤ 8000 |
| `id` | UUID from `crypto.randomUUID()` on create |
| timestamps | UTC ISO-8601 strings |

Client-side export of the **search-filtered** list uses the same JSON/Markdown
shapes but is generated in the browser (`client/src/exportNotes.ts`), not via
this endpoint.
