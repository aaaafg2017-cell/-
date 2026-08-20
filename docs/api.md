# API reference

Base URL:

- Development (Vite): `http://localhost:5173/api` — proxied to the Express server
- Direct API / production: `http://localhost:3001/api`

All `/api` responses set `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. JSON request bodies are limited to **256 KB**.

## Note object

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Shopping",
  "body": "Milk and bread",
  "createdAt": "2026-08-20T06:41:00.000Z",
  "updatedAt": "2026-08-20T06:45:00.000Z"
}
```

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string (UUID) | Assigned by the server on create |
| `title` | string | Required, trimmed, 1–200 characters |
| `body` | string | Optional, trimmed, at most 8,000 characters |
| `createdAt` | string | UTC ISO-8601 |
| `updatedAt` | string | UTC ISO-8601; equals `createdAt` until the first edit |

Lists are sorted by `updatedAt` descending (newest first).

## Endpoints

### `GET /api/health`

Liveness plus persistence status.

```json
{ "status": "ok", "persist": "ok", "uptime": 12.34 }
```

| `persist` | Meaning |
| --- | --- |
| `ok` | Data file loaded cleanly (or persistence is in-memory only) |
| `degraded` | Some records in the file were skipped as invalid; reads still work, writes return `503` |
| `unavailable` | File could not be parsed / read; list and writes return `503` |

`status` matches `persist` (`ok`, `degraded`, or `unavailable`).

### `GET /api/notes`

Returns an array of notes. `503` if persistence is `unavailable`.

### `GET /api/notes/:id`

Returns one note, or `404` `{ "error": "note not found" }`.

### `POST /api/notes`

Create a note. Body: `{ "title": string, "body"?: string }`.

- `201` with the created note
- `400` if the title is missing/blank or a field is too long
- `503` if the store is refusing writes

### `PUT /api/notes/:id`

Partial update. Send only the fields to change: `{ "title"?: string, "body"?: string }`.

- Omitted fields keep their current values
- Empty patch (`{}`) returns `400` `"title or body is required"`
- Unchanged values return the existing note without bumping `updatedAt`
- `404` if the id is unknown
- `503` if writes are refused

### `DELETE /api/notes/:id`

Deletes the note. `204` with an empty body, or `404` if missing.

### `GET /api/notes/export`

Downloads every note currently in the store.

| Query | Values | Default |
| --- | --- | --- |
| `format` | `json`, `md`, or `markdown` | `json` |

Invalid `format` returns `400` `{ "error": "format must be json or md" }`.

Response headers:

- `Content-Disposition: attachment; filename="notes-YYYY-MM-DD.json"` (or `.md`)
- `Content-Type: application/json; charset=utf-8` or `text/markdown; charset=utf-8`

JSON body:

```json
{
  "exportedAt": "2026-08-20T06:41:00.000Z",
  "count": 1,
  "notes": [ { "id": "…", "title": "…", "body": "…", "createdAt": "…", "updatedAt": "…" } ]
}
```

Markdown body starts with `# Notes`, then one `##` heading per note plus `id` / `created` / `updated` metadata.

The UI export buttons download the **currently visible / matching** notes in the browser. This endpoint always exports the **full store**.

## Error responses

JSON errors look like `{ "error": "human-readable message" }`.

| Status | When |
| --- | --- |
| `400` | Validation failure, malformed JSON (`invalid request body`), or bad export format |
| `404` | Unknown note id, or unknown `/api` path (`not found`) |
| `413` | Request body larger than 256 KB |
| `502` | Vite proxy could not reach the API (`api unreachable`) — development only |
| `503` | Persist error (unreadable or invalid data file); in-memory changes are rolled back |
| `500` | Unexpected server error |

## Examples

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost:3001/api/notes
curl -s -X POST http://localhost:3001/api/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"Hello","body":"World"}'
curl -s -X PUT http://localhost:3001/api/notes/<id> \
  -H 'Content-Type: application/json' \
  -d '{"body":"Updated body"}'
curl -s -o notes-export.json 'http://localhost:3001/api/notes/export?format=json'
curl -s -X DELETE http://localhost:3001/api/notes/<id> -o /dev/null -w '%{http_code}\n'
```
