# Notes App

A small full-stack starter used to bootstrap this repository's development
experience. It has two workspaces:

- **`client/`** — React + Vite + TypeScript single-page app.
- **`server/`** — Express + TypeScript REST API with file-backed notes.

The client proxies `/api/*` requests to the server during development, so you
run both together and interact with a single URL.

Arabic documentation: [`README.ar.md`](./README.ar.md).
Contributor / agent notes (Arabic): [`docs/CONTRIBUTING.ar.md`](./docs/CONTRIBUTING.ar.md).

## Prerequisites

- Node.js `>= 20` (developed against Node 22)
- npm `>= 10`

## Getting started

```bash
npm install        # install all workspace dependencies
npm run dev        # start the API (:3001) and the client (:5173) together
```

Then open http://localhost:5173 and create a note.

For a production build, the API also serves the compiled client:

```bash
npm run build
npm start          # http://localhost:3001 (API + UI)
```

## Common commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run client + server together with live reload |
| `npm run dev:server` | Run only the Express API on port `3001` |
| `npm run dev:client` | Run only the Vite dev server on port `5173` |
| `npm test` | Run all workspace test suites (Vitest) |
| `npm run typecheck` | Type-check every workspace |
| `npm run lint` | Lint the whole repo with ESLint |
| `npm run build` | Build the server and the client for production |
| `npm start` | Serve the production API and built UI on port `3001` |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check (`persist`: `ok`, `degraded`, or `unavailable`) |
| `GET` | `/api/notes` | List notes (newest `updatedAt` first) |
| `GET` | `/api/notes/export` | Download all notes (`?format=json` or `md`) |
| `GET` | `/api/notes/:id` | Fetch a single note |
| `POST` | `/api/notes` | Create a note `{ title, body? }` → `201` |
| `PUT` | `/api/notes/:id` | Partially update a note `{ title?, body? }` |
| `DELETE` | `/api/notes/:id` | Delete a note → `204` |

Titles are limited to 200 characters and bodies to 8,000. Invalid JSON and
missing titles return `400`. `PUT` is a partial update: omitted fields keep
their current values; an empty patch returns `400`. Request bodies over the
default `256kb` limit return `413`. Unknown `/api` routes return JSON `404`.

### Note shape

```json
{
  "id": "uuid",
  "title": "string",
  "body": "string",
  "createdAt": "UTC ISO-8601",
  "updatedAt": "UTC ISO-8601"
}
```

## Persistence and health

Notes are saved to `server/data/notes.json` (override with `NOTES_DATA_FILE`)
so they survive API restarts. Writes are atomic (`tmp` + rename). Disk write
failures return `503` and roll back in-memory state. The API file watcher
ignores `server/data` so saving a note does not restart the server. A corrupt
or unreadable file is never overwritten, and listing notes then returns `503`
instead of an empty list. Loaded timestamps are normalized to UTC ISO-8601 so
mixed formats still sort and show “edited” correctly. Invalid records (empty
titles, over-length fields, bad dates, or duplicate ids) are skipped: health
reports `degraded`, valid notes can still be listed, and writes return `503`
until the file is repaired.

| `persist` | Meaning | Reads | Writes |
| --- | --- | --- | --- |
| `ok` | Clean load | Allowed | Allowed |
| `degraded` | Some records skipped; ≥1 valid note kept | Allowed | Refused (`503`) |
| `unavailable` | Corrupt / unreadable / all records invalid | `503` | Refused |

## UI behavior

The UI follows the browser language (including Arabic/RTL), supports search
(including Arabic alef/tashkeel variants, hamza on waw/yeh, Persian yeh/kaf,
Eastern Arabic digits, Latin accents, and extra spaces),
asks before deleting, warns before discarding unsaved drafts, and can export
the **visible** (search-matching) notes as JSON or Markdown from the browser.

There is no in-app language toggle — locale is detected from the browser only.

## Export: two paths

| Source | What is exported | How |
| --- | --- | --- |
| UI export buttons | Notes matching the current search filter | Browser download |
| `GET /api/notes/export` | **All** notes in the store | HTTP attachment (`notes-YYYY-MM-DD.json\|md`) |

JSON payload shape is shared: `{ exportedAt, count, notes }`. The UI does not
call the server export endpoint.

## Environment variables

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | server | `3001` | Listen port (integer 1–65535) |
| `HOST` | server | `0.0.0.0` | Bind address |
| `NOTES_DATA_FILE` | server | `server/data/notes.json` | Persistence file path |
| `VITE_API_TARGET` | Vite (dev) | `http://127.0.0.1:3001` | `/api` proxy target |

## Project layout

```
.
├── client/          # React + Vite frontend
│   └── src/
│       ├── App.tsx          # CRUD, search, export, i18n wiring
│       ├── api.ts           # /api fetch helpers
│       ├── i18n.ts          # Locale detect, Arabic search normalize, copy
│       └── exportNotes.ts   # Client-side export + download
├── server/          # Express + TypeScript API
│   └── src/
│       ├── app.ts           # Routes, errors, static SPA serving
│       ├── notesStore.ts    # Model, file persistence, health states
│       ├── exportNotes.ts   # Server-side export rendering
│       └── index.ts         # Process entry (PORT/HOST/data/static)
├── eslint.config.js # Shared ESLint flat config
├── README.md        # English (this file)
├── README.ar.md     # Arabic documentation
└── package.json     # npm workspaces + top-level scripts
```

## Testing and CI

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

CI runs on Node **20.x** and **22.x**: `npm ci`, then typecheck, lint, test,
and build.

## Limits and quirks

- No auth or multi-user isolation — one shared JSON file; last writer wins
  across processes.
- Without a client build, `npm start` serves the API only.
- This is a development starter, not a production notes product.
