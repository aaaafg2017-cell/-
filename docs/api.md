# Notes REST API

[العربية](api.ar.md) · [README](../README.md) · [Architecture](architecture.md)

Base URL:

- Development UI: `http://localhost:5173/api` (Vite proxies to the server)
- API directly: `http://127.0.0.1:3001/api`
- Production (`npm start`): `http://localhost:3001/api`

All `/api` responses set `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff`. JSON request bodies are capped at **256 KB**.

## Note object

```json
{
  "id": "2f1c3a7e-9b0d-4c55-8a12-0e4b6d91f8aa",
  "title": "Shopping list",
  "body": "Milk, bread",
  "createdAt": "2026-08-20T06:41:00.000Z",
  "updatedAt": "2026-08-20T06:45:00.000Z"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Server-generated UUID |
| `title` | string | Trimmed; 1–200 characters |
| `body` | string | Trimmed; 0–8,000 characters |
| `createdAt` | string | UTC ISO-8601 |
| `updatedAt` | string | UTC ISO-8601; equals `createdAt` until the first real edit |

Lists are sorted by `updatedAt` descending.

## Errors

Error bodies are JSON: `{ "error": "<message>" }`.

| Status | When |
| --- | --- |
| `400` | Invalid JSON, missing/empty title, over-length fields, empty `PUT` body, or bad export `format` |
| `404` | Unknown note id, or unknown `/api` route |
| `413` | JSON body larger than 256 KB |
| `502` | Vite proxy could not reach the API (`{ "error": "api unreachable" }`) |
| `503` | Data file unreadable, partially invalid, or write failed |
| `500` | Unexpected server error |

## `GET /api/health`

Liveness plus persistence status.

```json
{
  "status": "ok",
  "persist": "ok",
  "uptime": 12.4
}
```

| `persist` | Meaning |
| --- | --- |
| `ok` | File loaded cleanly (or persistence is in-memory only) |
| `degraded` | Some records were skipped; reads of valid notes still work; writes are refused |
| `unavailable` | File could not be parsed; list/get/write all fail with `503` |

`status` mirrors `persist` (`ok` when healthy, otherwise the persist value).

## `GET /api/notes`

Returns an array of notes, newest first. Empty store: `[]`.

`503` if the data file is unreadable.

## `GET /api/notes/:id`

Returns one note, or `404` `{ "error": "note not found" }`.

## `POST /api/notes`

Create a note.

Request:

```json
{ "title": "Hello", "body": "Optional text" }
```

- `title` is required after trim.
- `body` is optional. Non-string values become `""`.
- Leading/trailing whitespace is stripped.

Response: `201` with the created note.

## `PUT /api/notes/:id`

Partial update. Only fields present in the JSON object are changed.

```json
{ "title": "New title" }
```

```json
{ "body": "New body" }
```

- Omitting both `title` and `body` returns `400` (`title or body is required`).
- Sending the same values as stored returns the existing note without bumping
  `updatedAt`.
- Unknown id: `404`.

## `DELETE /api/notes/:id`

Deletes the note. Success: `204` with an empty body. Unknown id: `404`.

## `GET /api/notes/export`

Downloads **all** notes (not the UI search filter).

| Query | Values | Default |
| --- | --- | --- |
| `format` | `json`, `md`, `markdown` | `json` |

Unknown `format` → `400` `{ "error": "format must be json or md" }`.

Headers:

- `Content-Disposition: attachment; filename="notes-YYYY-MM-DD.json"` (or `.md`)
- `Content-Type: application/json; charset=utf-8` or `text/markdown; charset=utf-8`

JSON payload:

```json
{
  "exportedAt": "2026-08-20T06:50:00.000Z",
  "count": 1,
  "notes": [ { "id": "...", "title": "...", "body": "...", "createdAt": "...", "updatedAt": "..." } ]
}
```

Markdown starts with `# Notes`, then `Exported` / `Count`, then one `##` section
per note (title, body, id, created, updated). `#` and `\` in titles are escaped.

## curl examples

```bash
# Health
curl -s http://127.0.0.1:3001/api/health

# Create
curl -s -X POST http://127.0.0.1:3001/api/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello","body":"First note"}'

# List
curl -s http://127.0.0.1:3001/api/notes

# Update title only
curl -s -X PUT http://127.0.0.1:3001/api/notes/<id> \
  -H 'Content-Type: application/json' \
  -d '{"title":"Updated"}'

# Export Markdown
curl -s 'http://127.0.0.1:3001/api/notes/export?format=md' -o notes.md

# Delete
curl -s -o /dev/null -w '%{http_code}\n' \
  -X DELETE http://127.0.0.1:3001/api/notes/<id>
```
