# Development

## Prerequisites

- Node.js `>= 20` (CI runs 20.x and 22.x)
- npm `>= 10` (workspaces)

No database, no Docker, no global tooling.

## Setup

```bash
npm install    # installs both workspaces from the root
npm run dev    # API on :3001, UI on :5173
```

Open <http://localhost:5173>. The Vite dev server proxies `/api/*` to the API, so
you only ever use the `5173` URL; the API port is an implementation detail during
development.

Both processes reload on save: `tsx watch` for the server, Vite HMR for the
client. The server's watcher ignores `server/data` and `*.tmp`, so saving a note
does not restart it.

## Scripts

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `npm run dev` | Both dev servers, colorized and interleaved via `concurrently` |
| `npm run dev:server` | Only the API (`:3001`) |
| `npm run dev:client` | Only the UI (`:5173`) |
| `npm test` | Vitest in every workspace |
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm run lint` | ESLint over the whole repo |
| `npm run build` | `tsc` for the server, `tsc && vite build` for the client |
| `npm start` | Runs `server/dist/index.js`; serves the API and, if built, the UI on `:3001` |

To target one workspace, append `--workspace server` or `--workspace client`.

## Configuration

The server reads its configuration from the environment at startup.

| Variable | Default | Effect |
| --- | --- | --- |
| `PORT` | `3001` | Listen port. A non-integer or out-of-range value throws at startup instead of silently falling back. |
| `HOST` | `0.0.0.0` | Listen address. |
| `NOTES_DATA_FILE` | `server/data/notes.json` | Where notes are stored. See [persistence](persistence.md). |

The client reads one variable, at dev/build time:

| Variable | Default | Effect |
| --- | --- | --- |
| `VITE_API_TARGET` | `http://127.0.0.1:3001` | Proxy target for `/api` in the Vite dev and preview servers. |

Both dev (`5173`) and preview (`4173`) use `strictPort`, so a busy port fails
loudly rather than silently moving.

Useful combinations:

```bash
PORT=4000 npm run dev:server                       # API on another port
VITE_API_TARGET=http://127.0.0.1:4000 npm run dev:client
NOTES_DATA_FILE=/tmp/notes-scratch.json npm run dev:server   # throwaway data
```

## Production build

```bash
npm run build
npm start        # http://localhost:3001 serves the API and the UI
```

`server/src/index.ts` looks for `client/dist/index.html` relative to the compiled
server. If it is missing, the process still starts and logs "Notes API listening"
instead of "Notes app listening" — a quick way to tell whether the UI was built.

## Testing

Both workspaces use Vitest. The server tests use `supertest` against an app built
with an in-memory `NotesStore`; the client tests use Testing Library in `jsdom`,
with `client/src/test/setup.ts` pinning `navigator.language` to `en-US` so
locale-dependent assertions are stable.

```bash
npm test                                   # everything
npm test --workspace server                # one workspace
cd server && npx vitest run src/app.test.ts   # one file
cd client && npx vitest run -t "exports"      # tests matching a name
cd client && npx vitest                       # watch mode
```

What is covered: the store's validation, persistence, degraded-mode, and
rollback behavior; every HTTP route including error and static-file cases; both
export renderers; the API client's response validation; locale detection and
search normalization; and the UI's create/edit/delete/search/export flows,
including the unsaved-changes guards and retry logic.

Tests never touch `server/data/notes.json`: persistence tests create temp
directories, and everything else uses the in-memory store.

When adding a feature, note that `exportNotes.ts` exists in both workspaces —
changing one usually means changing the other and both of their test files.

## Code style

TypeScript is `strict` in both workspaces (the client additionally enables
`noUnusedLocals` and `noUnusedParameters`), ESM everywhere (`"type": "module"`),
and a single flat ESLint config at the root covers both. Server imports use the
`.js` extension that Node's ESM resolver expects from compiled output; client
imports use `.ts`/`.tsx` extensions, which Vite resolves.

Before pushing:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

That is exactly what CI runs.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes and pull requests to `main`, on Node
20.x and 22.x: `npm ci`, then typecheck, lint, test, and build.

## Cloud Agent environment

`.cursor/environment.json` describes the sandbox used by Cursor Cloud Agents: it
installs with `.cursor/install.sh` (which prefers `npm ci` when a lockfile is
present), opens a terminal for each dev server, and exposes ports `5173` and
`3001`.

## Troubleshooting

**"Could not reach the notes API. Is the server running?"** The Vite proxy
answered `502` because nothing is listening on the API port. Start
`npm run dev:server`, or point `VITE_API_TARGET` at the right port.

**`Notes server failed to listen on 0.0.0.0:3001: EADDRINUSE`** Another process
holds the port; the server exits with code `1`. Free the port or set `PORT`.

**Vite exits with "Port 5173 is already in use".** `strictPort` is on. Stop the
other dev server rather than letting Vite pick a random port, since the proxy
setup assumes `5173`.

**Saving fails with "Could not load notes from disk".** The API returned `503`;
the data file is corrupt or has invalid records and the store refuses to
overwrite it. See [persistence](persistence.md) for how to inspect and repair the
file.

**The UI loads but shows stale notes.** Every API response sets
`Cache-Control: no-store` and the client fetches with `cache: "no-store"`, so
this is almost always a stale build being served: rerun `npm run build`.

**Notes vanished after a restart.** Check `NOTES_DATA_FILE`. With no override,
the file is `server/data/notes.json`, which is git-ignored and not part of any
build output.
