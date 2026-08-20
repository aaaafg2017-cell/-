# Notes App

[العربية](README.ar.md)

A small full-stack notes app: a React + Vite single-page client talking to an
Express + TypeScript API that stores notes in a JSON file. It is deliberately
tiny, but it handles the unglamorous parts — validation, atomic writes,
corrupt-file recovery, localization, and offline-ish error states — so it works
as a realistic starting point rather than a toy.

- **`client/`** — React 18 + Vite + TypeScript single-page app.
- **`server/`** — Express 4 + TypeScript REST API with file-backed notes.

The client proxies `/api/*` to the server during development, so you run both
together and use a single URL.

## Features

- Create, edit, and delete notes, newest first, with an "edited" marker.
- Search across titles and bodies, tolerant of Arabic alef/hamza/tashkeel
  variants, Persian yeh/kaf, Eastern Arabic digits, Latin accents, and extra
  spaces.
- Export the notes currently shown as JSON or Markdown, from the UI or the API.
- English and Arabic UI, chosen from the browser language, with full RTL
  layout.
- Notes persist to disk through atomic writes; a data file the server cannot
  fully read is never overwritten.
- Guards against losing work: unsaved-change confirmations, delete
  confirmation, startup retries, and localized error messages.

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

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API listen port |
| `HOST` | `0.0.0.0` | API listen address |
| `NOTES_DATA_FILE` | `server/data/notes.json` | Where notes are persisted |
| `VITE_API_TARGET` | `http://127.0.0.1:3001` | Proxy target used by the dev/preview client |

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

Titles are limited to 200 characters and bodies to 8,000; `PUT` keeps the
fields you omit. Errors are always JSON, and unknown `/api` routes return a
JSON `404`. The [API reference](docs/api.md) documents every payload, status
code, and persistence state.

## Data and durability

Notes are saved to `server/data/notes.json` (override with `NOTES_DATA_FILE`)
so they survive API restarts. Writes go to a temporary file and are renamed
into place, and a failed write rolls the in-memory change back. If the data
file is corrupt or holds invalid records, the server keeps serving what it
could read, reports `degraded` or `unavailable` from `/api/health`, and returns
`503` for writes instead of overwriting the file.

## Project layout

```
.
├── client/          # React + Vite frontend
├── server/          # Express + TypeScript API
├── docs/            # API reference, architecture, development guide
├── eslint.config.js # Shared ESLint flat config
└── package.json     # npm workspaces + top-level scripts
```

## Documentation

- [API reference](docs/api.md)
- [Architecture](docs/architecture.md)
- [Development guide](docs/development.md)
