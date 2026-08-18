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

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/notes` | List notes (newest first) |
| `GET` | `/api/notes/:id` | Fetch a single note |
| `POST` | `/api/notes` | Create a note `{ title, body? }` |
| `PUT` | `/api/notes/:id` | Partially update a note `{ title?, body? }` |
| `DELETE` | `/api/notes/:id` | Delete a note |

Titles are limited to 200 characters and bodies to 8,000. Invalid JSON and
missing titles return `400`. `PUT` is a partial update: omitted fields keep
their current values. Unknown `/api` routes return JSON `404`. Notes are
saved to `server/data/notes.json` (override with `NOTES_DATA_FILE`) so they survive
API restarts. Writes are atomic (`tmp` + rename) and a corrupt file is never
overwritten. The UI follows the browser language (including Arabic/RTL),
supports search, and asks before deleting.

## Project layout

```
.
├── client/          # React + Vite frontend
├── server/          # Express + TypeScript API
├── eslint.config.js # Shared ESLint flat config
└── package.json     # npm workspaces + top-level scripts
```
