# Architecture

Notes App is a small full-stack system with a React SPA and an Express REST API.
Persistence is a single JSON file on disk, not a database.

## High-level diagram

```text
Browser (React + Vite)
  │  /api/*  (dev: Vite proxy → :3001)
  ▼
Express API  (server/src/app.ts)
  │
  ▼
NotesStore   (server/src/notesStore.ts)
  │
  ▼
JSON file    (NOTES_DATA_FILE or server/data/notes.json)
```

In production (`npm run build && npm start`), Express also serves `client/dist`
and falls back to `index.html` for SPA routes (paths without a file extension).

## Workspaces

| Package | Role | Key entry points |
| --- | --- | --- |
| `client` | UI, client search, client-side export download | `src/App.tsx`, `src/api.ts`, `src/i18n.ts`, `src/exportNotes.ts` |
| `server` | REST API, persistence, server-side export | `src/index.ts`, `src/app.ts`, `src/notesStore.ts`, `src/exportNotes.ts` |
| root | npm workspaces, shared ESLint, orchestration scripts | `package.json`, `eslint.config.js` |

## Request flow

1. The UI calls `/api/notes` (and related routes) through `client/src/api.ts`.
2. In development, Vite proxies `/api` to `VITE_API_TARGET` (default `http://127.0.0.1:3001`). If the API is down, the proxy returns JSON `502` `{ "error": "api unreachable" }`.
3. `createApp()` wires routes, validation/persist error mapping, optional static hosting, and SPA fallback.
4. `NotesStore` keeps an in-memory `Map`, loads from disk on startup, and writes atomically (`*.tmp` + `rename`).

## Persistence model

Each note:

```ts
{
  id: string;        // UUID
  title: string;     // required, trimmed, ≤ 200 chars
  body: string;      // trimmed, ≤ 8000 chars (empty allowed)
  createdAt: string; // UTC ISO-8601
  updatedAt: string; // UTC ISO-8601
}
```

Notes are listed newest-`updatedAt` first. Timestamps from disk are normalized
to UTC ISO-8601 so mixed input formats still sort and show “edited” correctly.

### Persist health (`persistStatus`)

| Status | Meaning |
| --- | --- |
| `ok` | File loaded cleanly (or no file yet / in-memory only) |
| `degraded` | Some invalid records were skipped; valid notes remain readable; writes refused |
| `unavailable` | File unreadable/corrupt and no valid notes; list/get throw; writes refused |

Corrupt or partially invalid files are **never overwritten**. Write failures roll
back the in-memory mutation and return `503`.

The API file watcher excludes `server/data` so saving a note does not restart
the `tsx watch` process.

## Client behavior

- Locale: `detectLocale()` uses the browser language; Arabic (`ar` / `ar-*`) enables RTL and Arabic copy.
- Search: `normalizeForSearch()` folds Arabic alef/tashkeel/hamza variants, Persian yeh/kaf, Eastern digits, Latin accents, and extra spaces.
- Export: the UI exports the **currently matching** notes (search filter applied) as JSON or Markdown via Blob download.
- Editing guards: confirm discard on cancel/navigation intent; `beforeunload` when dirty; Escape cancels with confirm when dirty.
- Initial load retries transient network / proxy `502`/`504` errors.

## Export formats

Shared shape on client and server:

- **JSON**: `{ exportedAt, count, notes }` pretty-printed, filename `notes-YYYY-MM-DD.json`
- **Markdown**: `# Notes` heading, metadata, then `## title` sections with body and id/created/updated bullets, filename `notes-YYYY-MM-DD.md`

Server export (`GET /api/notes/export`) exports **all** stored notes.
Client export buttons export the **filtered visible** list.

## Security / hardening notes

- `X-Powered-By` disabled
- API responses: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`
- JSON body limit default `256kb`
- Hashed `/assets/*` get long-cache headers; `index.html` is `no-store`
- Missing static files with extensions return `404` (no SPA fallback for `/favicon.ico`-style paths)

## Cloud Agent environment

`.cursor/environment.json` installs via `.cursor/install.sh` and starts
`dev:server` + `dev:client` on ports `3001` and `5173`.
