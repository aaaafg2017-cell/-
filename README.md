# Notes App

A small full-stack starter used to bootstrap this repository's development
experience. It has two workspaces:

- **`client/`** — React + Vite + TypeScript single-page app.
- **`server/`** — Express + TypeScript REST API with file-backed notes.

The client proxies `/api/*` requests to the server during development, so you
run both together and interact with a single URL.

**Languages:** [English](README.md) · [العربية](README.ar.md)

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

## Features

- Create, edit, and delete notes (delete asks for confirmation)
- Atomic disk persistence in `server/data/notes.json`
- Client-side search with Arabic-aware normalization (alef/tashkeel/hamza,
  Persian yeh/kaf, Eastern digits, Latin accents, extra spaces)
- UI follows the browser language (Arabic/RTL or English/LTR)
- Export the visible (search-filtered) notes as JSON or Markdown
- Unsaved-change guards (`Escape`, `beforeunload`)
- Health endpoint reports persist status: `ok`, `degraded`, or `unavailable`

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

Full contracts: [`docs/API.md`](docs/API.md).

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | API listen port |
| `HOST` | `0.0.0.0` | API bind address |
| `NOTES_DATA_FILE` | `server/data/notes.json` | Notes JSON persistence path |
| `VITE_API_TARGET` | `http://127.0.0.1:3001` | Vite `/api` proxy target in development |

## Project layout

```
.
├── client/          # React + Vite frontend
├── server/          # Express + TypeScript API
├── docs/            # Architecture and API documentation
├── .cursor/         # Cloud Agent install + environment
├── eslint.config.js # Shared ESLint flat config
├── README.md        # English (this file)
├── README.ar.md     # Arabic documentation
└── package.json     # npm workspaces + top-level scripts
```

## Documentation

| Doc | Contents |
| --- | --- |
| [README.ar.md](README.ar.md) | Arabic project guide |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [AR](docs/ARCHITECTURE.ar.md) | Layers, persistence, i18n, export |
| [docs/API.md](docs/API.md) · [AR](docs/API.ar.md) | Request/response contracts and errors |

## Cursor Cloud

- Install: `bash .cursor/install.sh` (uses `npm ci` when `package-lock.json` exists)
- Terminals start `npm run dev:server` and `npm run dev:client`
- Ports: client `5173`, server `3001`

## Testing and CI

GitHub Actions runs on Node 20 and 22: install, typecheck, lint, test, build.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
