# AGENTS.md

Guidance for Cloud Agents and contributors working on this repository.

## Project overview

Notes App is a small full-stack starter with two npm workspaces:

| Workspace | Stack | Role |
| --- | --- | --- |
| `client/` | React 18, Vite 6, TypeScript | Single-page UI with Arabic/RTL support |
| `server/` | Express 4, TypeScript | REST API with JSON-file persistence |

During development, Vite proxies `/api/*` to the Express server so the UI is served from one origin (`http://localhost:5173`). In production, the built client is served from the same Express process on port `3001`.

## Environment setup

The Cloud Agent environment is configured in `.cursor/environment.json`:

- **Install:** `bash .cursor/install.sh` (runs `npm ci` when `package-lock.json` exists)
- **Dev server:** port `5173` (client), port `3001` (API)
- **Terminals:** `npm run dev:server` and `npm run dev:client` (or `npm run dev` for both)

### Prerequisites

- Node.js `>= 20` (CI tests Node 20 and 22)
- npm `>= 10`

### Common commands

```bash
npm install          # install all workspace dependencies
npm run dev          # client (:5173) + API (:3001) with live reload
npm test             # Vitest in every workspace
npm run typecheck    # TypeScript check every workspace
npm run lint         # ESLint (flat config at repo root)
npm run build        # compile server + build client
npm start            # production API + static UI on :3001
```

## Architecture

```
Browser (:5173 dev / :3001 prod)
    │
    ├─ GET /          → Vite (dev) or Express static (prod)
    └─ /api/*         → Express API
                            │
                            └─ NotesStore → server/data/notes.json
```

### Key modules

| Path | Purpose |
| --- | --- |
| `server/src/app.ts` | Express routes, error handling, optional static hosting |
| `server/src/notesStore.ts` | In-memory notes with atomic file persistence |
| `server/src/exportNotes.ts` | JSON/Markdown export (shared logic with client) |
| `client/src/App.tsx` | Main UI: CRUD, search, export, i18n |
| `client/src/api.ts` | Fetch wrapper and response validation |
| `client/src/i18n.ts` | English/Arabic copy and search normalization |
| `client/src/exportNotes.ts` | Client-side export download |

### Persistence

- Default data file: `server/data/notes.json`
- Override with `NOTES_DATA_FILE`
- Writes are atomic (write temp file, then rename)
- Corrupt or partially invalid files are never overwritten; health reports `degraded` or `unavailable`
- `tsx watch` excludes `server/data/` so saving notes does not restart the dev server

### Internationalization

- Locale follows the browser language (`ar` → RTL layout and Arabic strings)
- Client search normalizes Arabic alef/tashkeel variants, hamza, Persian yeh/kaf, Eastern Arabic digits, Latin accents, and extra spaces

## Environment variables

| Variable | Default | Used by | Description |
| --- | --- | --- | --- |
| `PORT` | `3001` | server | HTTP listen port |
| `HOST` | `0.0.0.0` | server | HTTP listen host |
| `NOTES_DATA_FILE` | `server/data/notes.json` | server | Path to persisted notes JSON |
| `VITE_API_TARGET` | `http://127.0.0.1:3001` | client (dev) | Upstream for Vite `/api` proxy |

## API quick reference

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health (`persist`: `ok`, `degraded`, `unavailable`) |
| `GET` | `/api/notes` | List notes (newest first) |
| `GET` | `/api/notes/export` | Download notes (`?format=json` or `md`) |
| `GET` | `/api/notes/:id` | Single note |
| `POST` | `/api/notes` | Create `{ title, body? }` |
| `PUT` | `/api/notes/:id` | Partial update `{ title?, body? }` |
| `DELETE` | `/api/notes/:id` | Delete note |

Limits: title ≤ 200 characters, body ≤ 8,000 characters. Invalid JSON or missing title → `400`. Disk failures → `503`.

## Testing

### Automated tests

```bash
npm test             # all workspaces
npm run typecheck
npm run lint
npm run build
```

- **Server:** Vitest + Supertest against `createApp()` with in-memory `NotesStore`
- **Client:** Vitest + Testing Library + jsdom

Run a single workspace:

```bash
npm test --workspace server
npm test --workspace client
```

### Manual / GUI testing

When changing UI behavior:

1. Start `npm run dev` (or use the environment terminals).
2. Open `http://localhost:5173`.
3. Verify create, edit, delete, search, export, and Arabic/RTL if relevant.

For Arabic UI: set the browser language to Arabic or use a locale override in devtools.

### What CI runs

GitHub Actions (`.github/workflows/ci.yml`) on Node 20 and 22: `npm ci`, typecheck, lint, test, build.

## Documentation

| Document | Audience |
| --- | --- |
| `README.md` | English — setup, API, project layout |
| `docs/README.ar.md` | Arabic — same content in Arabic |
| `AGENTS.md` | Cloud Agents and contributors |

## Conventions

- TypeScript ESM throughout (`"type": "module"`)
- Shared ESLint flat config at repo root (`eslint.config.js`)
- Keep client and server export logic aligned (`exportNotes.ts` in both workspaces)
- Prefer minimal, focused diffs; match existing naming and patterns
- Do not commit `server/data/notes.json` user data unless intentionally part of a test fixture
