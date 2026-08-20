# Notes App

[العربية](README.ar.md)

A small full-stack notes app: create, edit, search, and export notes that survive
a restart. It has two workspaces:

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

## Documentation

| Page | What it covers |
| --- | --- |
| [Architecture](docs/architecture.md) | How the client, API, and data file fit together |
| [API reference](docs/api.md) | Every endpoint, payload, status code, and header |
| [Persistence](docs/persistence.md) | The `notes.json` format, atomic writes, and degraded modes |
| [Frontend guide](docs/frontend.md) | UI state, localization, search normalization, export |
| [Development](docs/development.md) | Scripts, configuration, testing, CI, troubleshooting |

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
missing titles return `400`, unknown `/api` routes return JSON `404`, and `PUT`
is a partial update — omitted fields keep their current values. The full rules,
including error messages and export formats, are in the
[API reference](docs/api.md).

Notes are saved to `server/data/notes.json` (override with `NOTES_DATA_FILE`)
using atomic writes, so they survive API restarts. A corrupt or partially
invalid file is never overwritten: the API reports `degraded` or `unavailable`
health and returns `503` for the affected operations until the file is repaired.
See [persistence](docs/persistence.md).

The UI follows the browser language (including Arabic/RTL), supports search that
tolerates Arabic alef/tashkeel variants, hamza on waw/yeh, Persian yeh/kaf,
Eastern Arabic digits, Latin accents, and extra spaces, asks before deleting or
discarding unsaved edits, and can export the visible notes as JSON or Markdown.
See the [frontend guide](docs/frontend.md).

## Project layout

```
.
├── client/          # React + Vite frontend
├── server/          # Express + TypeScript API
├── docs/            # Architecture, API, persistence, frontend, development docs
├── eslint.config.js # Shared ESLint flat config
└── package.json     # npm workspaces + top-level scripts
```
