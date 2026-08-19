# Notes App

A small full-stack starter used to bootstrap this repository's development
experience. It has two workspaces:

- **`client/`** — React + Vite + TypeScript single-page app.
- **`server/`** — Express + TypeScript REST API with file-backed notes.

The client proxies `/api/*` requests to the server during development, so you
run both together and interact with a single URL.

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
| `GET` | `/api/notes` | List notes (newest first) |
| `GET` | `/api/notes/export` | Download all notes (`?format=json` or `md`) |
| `GET` | `/api/notes/:id` | Fetch a single note |
| `POST` | `/api/notes` | Create a note `{ title, body? }` |
| `PUT` | `/api/notes/:id` | Partially update a note `{ title?, body? }` |
| `DELETE` | `/api/notes/:id` | Delete a note |

Titles are limited to 200 characters and bodies to 8,000. Invalid JSON and
missing titles return `400`. `PUT` is a partial update: omitted fields keep
their current values. Unknown `/api` routes return JSON `404`. Notes are
saved to `server/data/notes.json` (override with `NOTES_DATA_FILE`) so they survive
API restarts. Writes are atomic (`tmp` + rename). Disk write failures return
`503` and roll back in-memory state. The API file watcher ignores
`server/data` so saving a note does not restart the server. A corrupt or unreadable file is never overwritten, and listing notes then
returns `503` instead of an empty list. Loaded timestamps are normalized to
UTC ISO-8601 so mixed formats still sort and show “edited” correctly. Invalid records (empty titles, over-length
fields, bad dates, or duplicate ids) are skipped: health reports `degraded`,
valid notes can still be listed, and writes return `503` until the file is repaired.
The UI follows the browser language (including Arabic/RTL), supports search
(including Arabic alef/tashkeel variants, hamza on waw/yeh, and extra spaces),
asks before deleting, and can export the visible notes as JSON or Markdown.

## Project layout

```
.
├── client/          # React + Vite frontend
├── server/          # Express + TypeScript API
├── eslint.config.js # Shared ESLint flat config
└── package.json     # npm workspaces + top-level scripts
```
