# Development guide

## Prerequisites

- Node.js `>= 20` (CI runs 20.x and 22.x)
- npm `>= 10` — the repo uses npm workspaces, so install from the root only

## Install and run

```bash
npm install     # installs root, server, and client dependencies
npm run dev     # API on :3001 and Vite on :5173, in one terminal
```

Open http://localhost:5173. The Vite dev server proxies `/api/*` to the API, so
you never call `:3001` directly from the browser. Both processes reload on
save; the API watcher deliberately ignores `server/data` and `*.tmp` files so
saving a note does not restart the server.

To run only one side, use `npm run dev:server` or `npm run dev:client`. A
client started on its own answers `/api/*` with
`502 {"error":"api unreachable"}` until the API is up.

## Production build

```bash
npm run build   # tsc for the server, tsc + vite build for the client
npm start       # single process on :3001 serving the API and the built UI
```

`npm start` runs the compiled `server/dist/index.js`, which serves
`client/dist` only if that directory contains an `index.html` — so build the
client before expecting the UI at `:3001`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run client and server together with live reload |
| `npm run dev:server` | Express API on `:3001` via `tsx watch` |
| `npm run dev:client` | Vite dev server on `:5173` |
| `npm test` | Vitest suites in every workspace |
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm run lint` | ESLint across the repo |
| `npm run build` | Production build of both workspaces |
| `npm start` | Serve the production API and built UI |

Workspace-scoped runs use the same names, for example
`npm run test --workspace client` or `npm run preview --workspace client`
(serves `client/dist` on `:4173`, also proxying `/api`).

## Configuration

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | server | `3001` | Listen port; a non-integer or out-of-range value aborts startup |
| `HOST` | server | `0.0.0.0` | Listen address |
| `NOTES_DATA_FILE` | server | `server/data/notes.json` | Where notes are persisted |
| `VITE_API_TARGET` | client dev/preview | `http://127.0.0.1:3001` | Proxy target for `/api` |

Both dev ports are `strictPort`, so Vite fails loudly instead of silently
moving to another port. `server/data/` is gitignored; point
`NOTES_DATA_FILE` somewhere under `/tmp` when you want a throwaway dataset:

```bash
NOTES_DATA_FILE=/tmp/notes.json npm run dev:server
```

## Testing

```bash
npm test                                        # everything
npm run test --workspace server                 # one workspace
npm run test --workspace server -- src/app.test.ts   # one file
npm run test --workspace client -- -t "search"       # one test name
```

Server tests use Supertest against an in-memory `NotesStore`; store tests use
temporary files. Client tests use Testing Library and jsdom with a mocked
`fetch`, and `client/src/test/setup.ts` pins `navigator.language` to `en-US` so
locale-dependent assertions are stable — an Arabic test must override the
navigator itself.

Add tests next to the code they cover as `<name>.test.ts(x)`; both workspaces
run Vitest with globals enabled, so `describe`/`it`/`expect` need no import.

## CI

`.github/workflows/ci.yml` runs on pushes and pull requests to `main`, across
Node 20.x and 22.x: `npm ci`, then typecheck, lint, test, and build. Running
`npm run typecheck && npm run lint && npm test && npm run build` locally
reproduces it exactly.

## Cursor cloud environment

`.cursor/environment.json` installs with `.cursor/install.sh` (`npm ci` when a
lockfile is present, otherwise `npm install`) and opens two terminals running
`dev:server` and `dev:client`, exposing ports 3001 and 5173.

## Conventions

- TypeScript everywhere, ESM only (`"type": "module"`); relative imports in the
  server use the `.js` extension, and the client imports `.ts`/`.tsx`
  explicitly.
- Keep HTTP concerns in `app.ts` and domain rules in `notesStore.ts`; new
  failure modes should surface as `ValidationError` or `PersistError`.
- The client must keep treating API responses as untrusted input — extend
  `parseNote` when the note shape changes.
- New user-facing strings go in both `copy.en` and `copy.ar` in
  `client/src/i18n.ts`; the object is `as const`, so a missing Arabic key is a
  type error.
- The two `exportNotes.ts` modules must stay output-compatible: change both,
  and update both test suites.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Notes server failed to listen on 0.0.0.0:3001: listen EADDRINUSE` | Another API is running; stop it or set `PORT` |
| Port `5173` is already in use | `strictPort` is on; stop the other Vite or change the port in `client/vite.config.ts` |
| UI shows "Could not reach the notes API" | The API is down or on another port; start it or set `VITE_API_TARGET` |
| UI shows "Could not load notes from disk" | `persist` is `degraded`/`unavailable`; check `GET /api/health` and the server log, repair `notes.json`, restart |
| Saving fails with `503` | Same as above — the store refuses to overwrite a data file it could not fully load |
| `:3001` serves JSON but no UI | `client/dist` is missing; run `npm run build` |
