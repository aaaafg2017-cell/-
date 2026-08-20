# Architecture

The Notes app is an npm-workspaces monorepo with two deployable pieces: a React
single-page app and an Express JSON API. The API owns all state; the client
holds no database of its own and re-reads the API after every mutation.

## Topology

### Development

Two processes run side by side. Vite serves the UI on port `5173` and proxies
every `/api/*` request to the API on port `3001`, so the browser only ever talks
to one origin and there are no CORS or cookie surprises.

```
browser ──▶ Vite dev server (5173) ──/api/*──▶ Express API (3001) ──▶ server/data/notes.json
             └── React app, HMR
```

The proxy is configured in `client/vite.config.ts`. If the API is down, the
proxy answers `502 {"error":"api unreachable"}` instead of hanging, which is what
lets the client show a "Could not reach the notes API" message and a retry
button.

### Production

`npm run build` compiles the server to `server/dist` and the client to
`client/dist`. On boot, `server/src/index.ts` checks for
`client/dist/index.html`; if it exists, the same Express process serves the UI
and the API on port `3001`.

```
browser ──▶ Express (3001) ──┬── /api/*  ──▶ NotesStore ──▶ server/data/notes.json
                             └── /*      ──▶ client/dist (static files + SPA fallback)
```

Static handling has three rules worth knowing: files under `assets/` are served
with `Cache-Control: public, max-age=31536000, immutable` (Vite hashes their
names), any path with a file extension that does not exist returns `404` instead
of falling back to `index.html`, and every other `GET`/`HEAD` returns
`index.html` with `Cache-Control: no-store`.

## Layers

### `server/src/notesStore.ts` — domain and storage

`NotesStore` is the only place that knows what a valid note is. It holds notes in
a `Map<string, Note>`, validates and normalizes input, and (when constructed with
a path) mirrors the map to a JSON file. It throws two error types that the HTTP
layer maps to status codes: `ValidationError` → `400` and `PersistError` → `503`.

Constructing the store without a path gives a pure in-memory store, which is how
every API test stays isolated.

### `server/src/app.ts` — HTTP layer

`createApp(store, options)` builds the Express app. It is deliberately a factory
so tests can inject a store and a `staticDir`, and so `index.ts` stays a thin
bootstrap. Routes do no validation of their own beyond parsing the export
format; they delegate to the store and let the error middleware translate
thrown errors.

Route order matters in one place: `GET /api/notes/export` is registered before
`GET /api/notes/:id` so `export` is not treated as a note id.

### `server/src/index.ts` — process bootstrap

Reads `PORT`, `HOST`, and `NOTES_DATA_FILE`, decides whether a built client
exists, starts listening, and exits with code `1` on a listen error (for example
a port already in use).

### `client/src/api.ts` — typed API client

Wraps `fetch` with `cache: "no-store"`, unwraps `{ error }` bodies into
`ApiError` (which carries the HTTP status), and — importantly — re-validates
every note it receives. A malformed payload becomes an `ApiError`, never a
half-rendered note.

### `client/src/App.tsx` — UI

A single component holding all state: the note list, the form, the search query,
and the in-flight/error flags. See the [frontend guide](frontend.md).

### Shared-by-duplication modules

`exportNotes.ts` exists in both workspaces with near-identical logic, because the
same export can be produced server-side (as an HTTP download) or client-side
(from the currently filtered list, without a round trip). The two copies are kept
byte-compatible in output; the only difference is that the client version also
has `downloadText` and names the field `mime` instead of `contentType`. If you
change one, change the other and update both test files.

## Request flow: creating a note

1. The form submits; `App.tsx` blocks the submit if a request is already in
   flight, then trims and validates the title locally.
2. `createNote()` sends `POST /api/notes`.
3. Express parses JSON (max `256kb`) and calls `store.create()`.
4. The store normalizes the input, assigns a `crypto.randomUUID()` id and
   matching `createdAt`/`updatedAt`, inserts into the map, then writes the file.
5. If the write throws, the in-memory insert is rolled back and a `PersistError`
   propagates, so the client gets `503` and the server's memory still matches
   disk.
6. On success the API returns `201` with the note; the client merges it into the
   list and then re-fetches to stay authoritative.

## Module map

```
.
├── client/
│   ├── index.html            # Sets <html lang/dir> and the title before React boots
│   ├── vite.config.ts        # Dev/preview servers, /api proxy, Vitest (jsdom) config
│   └── src/
│       ├── main.tsx          # React root
│       ├── App.tsx           # All UI state and rendering
│       ├── api.ts            # fetch wrapper + response validation (ApiError)
│       ├── exportNotes.ts    # Client-side JSON/Markdown export + download
│       ├── i18n.ts           # Locale detection, copy, search normalization
│       └── index.css         # Styles (logical properties, so RTL works)
├── server/
│   └── src/
│       ├── index.ts          # Bootstrap: env, static dir, listen
│       ├── app.ts            # Routes, security headers, error middleware
│       ├── notesStore.ts     # Validation, in-memory map, atomic file persistence
│       └── exportNotes.ts    # Server-side JSON/Markdown export rendering
├── docs/                     # This documentation
├── eslint.config.js          # Shared flat config for both workspaces
└── package.json              # Workspaces + top-level scripts
```

## Design decisions

**A JSON file instead of a database.** The app is a starter; a file keeps setup
to `npm install`. The cost is that writes are whole-file and single-process, so
this is not a design to run in more than one replica.

**Refuse to overwrite data you could not read.** If the data file is corrupt or
contains invalid records, the store never rewrites it. Reads may still succeed
for the valid subset, but writes fail with `503` until a human fixes the file.
See [persistence](persistence.md).

**Validate on both sides of the wire.** The server validates because clients
lie; the client validates because a proxy, a stale service worker, or a partially
corrupt store can produce a body that is JSON but not a note.

**No client-side router or state library.** One screen, one component, one
source of truth. Adding React Router or a store would be the first change if the
app grew a second screen.
