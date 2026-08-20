# API reference

Base URL: `http://localhost:3001` in development and production, or `/api` from
the browser (the Vite dev server proxies it).

All endpoints live under `/api`. Requests and responses are JSON unless stated
otherwise, and every response body is UTF-8.

## Conventions

### The note object

```json
{
  "id": "0f3c4c9e-1b3a-4a2c-9f0f-2f4f8b6f1a77",
  "title": "Buy milk",
  "body": "2 liters",
  "createdAt": "2026-08-20T06:42:00.000Z",
  "updatedAt": "2026-08-20T06:42:00.000Z"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Server-generated UUID v4. Never accepted from the client. |
| `title` | string | Trimmed, 1–200 characters. |
| `body` | string | Trimmed, 0–8000 characters. Always a string, never `null`. |
| `createdAt` | string | UTC ISO-8601, set once at creation. |
| `updatedAt` | string | UTC ISO-8601. Equal to `createdAt` until the note actually changes. |

Lists are always sorted by `updatedAt`, newest first.

### Errors

Every error response is `{"error": "<message>"}`.

| Status | When |
| --- | --- |
| `400` | Validation failure, malformed JSON, or an unknown export format |
| `404` | Unknown note id, or an unknown `/api/*` route |
| `413` | Request body larger than the JSON parser limit (`256kb` by default) |
| `503` | The notes data file could not be read or written — see [persistence](persistence.md) |
| `500` | Unexpected server error (logged server-side, generic message to the client) |

A `503` is the only error that is not the caller's fault: it means the API is
intentionally refusing to touch a data file it could not fully load.

### Headers

Every `/api` response carries:

- `Cache-Control: no-store`
- `X-Content-Type-Options: nosniff`

`X-Powered-By` is disabled, and CORS is enabled for all origins (`cors()` with
defaults), which is what lets a separately hosted client call the API directly.

## `GET /api/health`

Liveness plus the persistence state. Always `200`, even when persistence is
broken — check the `persist` field rather than the status code.

```bash
curl -s http://localhost:3001/api/health
```

```json
{ "status": "ok", "persist": "ok", "uptime": 12.34 }
```

| Field | Values |
| --- | --- |
| `persist` | `ok`, `degraded` (some records were skipped; writes refused), `unavailable` (nothing could be loaded) |
| `status` | `ok` when `persist` is `ok`, otherwise mirrors `persist` |
| `uptime` | Process uptime in seconds |

## `GET /api/notes`

Lists all notes, newest first.

```bash
curl -s http://localhost:3001/api/notes
```

- `200` — a JSON array (`[]` when there are no notes)
- `503` — the data file could not be loaded at all

A `degraded` store still lists the records it could parse.

## `GET /api/notes/export`

Downloads all notes as one file. This is the server-side export; the UI's export
buttons render the same formats in the browser from the *filtered* list.

| Query | Values | Default |
| --- | --- | --- |
| `format` | `json`, `md` (`markdown` is accepted as an alias, case-insensitive) | `json` |

```bash
curl -sOJ http://localhost:3001/api/notes/export            # notes-YYYY-MM-DD.json
curl -sOJ 'http://localhost:3001/api/notes/export?format=md' # notes-YYYY-MM-DD.md
```

Responses set `Content-Disposition: attachment; filename="notes-<YYYY-MM-DD>.<ext>"`
and `Content-Type: application/json; charset=utf-8` or
`text/markdown; charset=utf-8`.

JSON export body:

```json
{
  "exportedAt": "2026-08-20T06:42:00.000Z",
  "count": 1,
  "notes": [{ "id": "…", "title": "Buy milk", "body": "2 liters", "createdAt": "…", "updatedAt": "…" }]
}
```

Markdown export body:

```markdown
# Notes

Exported: 2026-08-20T06:42:00.000Z
Count: 1

## Buy milk

2 liters

- id: `0f3c4c9e-…`
- created: 2026-08-20T06:42:00.000Z
- updated: 2026-08-20T06:42:00.000Z
```

Notes are separated by `---`, `#` in titles is escaped so it cannot forge a
heading, and an empty export renders `_No notes._`.

- `200` — the file
- `400` — `{"error":"format must be json or md"}`
- `503` — the data file could not be loaded

## `GET /api/notes/:id`

```bash
curl -s http://localhost:3001/api/notes/0f3c4c9e-1b3a-4a2c-9f0f-2f4f8b6f1a77
```

- `200` — the note
- `404` — `{"error":"note not found"}`
- `503` — the data file could not be loaded

## `POST /api/notes`

Creates a note.

```bash
curl -s -X POST http://localhost:3001/api/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"Buy milk","body":"2 liters"}'
```

| Field | Required | Rules |
| --- | --- | --- |
| `title` | yes | Trimmed; must be non-empty after trimming; at most 200 characters |
| `body` | no | Trimmed; at most 8000 characters. A non-string (or missing) value becomes `""` |

- `201` — the created note
- `400` — `title is required`, `title must be at most 200 characters`,
  `body must be at most 8000 characters`, or `invalid request body` for malformed JSON
- `413` — `request body too large`
- `503` — the write failed or the store is refusing to write

## `PUT /api/notes/:id`

Partial update. Only the fields you send are changed; omitted fields keep their
current value.

```bash
curl -s -X PUT http://localhost:3001/api/notes/<id> \
  -H 'Content-Type: application/json' \
  -d '{"title":"Buy oat milk"}'
```

Behavior worth knowing:

- Sending neither `title` nor `body` (or sending them as `undefined`) is a `400`
  with `title or body is required`.
- Sending `"body": "   "` clears the body — trimming happens first.
- If the normalized values are identical to what is stored, the note is returned
  unchanged and `updatedAt` is **not** bumped, so a no-op save does not mark the
  note as edited or reorder the list.

Responses: `200` with the note, `400`, `404`, `413`, or `503`.

## `DELETE /api/notes/:id`

```bash
curl -s -i -X DELETE http://localhost:3001/api/notes/<id>
```

- `204` — deleted, empty body
- `404` — `{"error":"note not found"}`
- `503` — the write failed or the store is refusing to write

## Unknown routes

Any other path under `/api` returns `404` with `{"error":"not found"}` — JSON,
not the SPA's `index.html`, even when the server is also serving the built
client.

## Static routes (production only)

When `client/dist/index.html` exists, the API process also serves the UI:

| Path | Behavior |
| --- | --- |
| `/assets/*` | Served with `Cache-Control: public, max-age=31536000, immutable` |
| Any path with a file extension that does not exist | `404` (so a missing hashed asset fails loudly instead of returning HTML) |
| Any other `GET`/`HEAD` | `index.html` with `Cache-Control: no-store` |
