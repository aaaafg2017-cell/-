# Architecture

The repository is a two-workspace npm monorepo: a React single-page app and an
Express API that also serves that app in production.

```
browser
  │  fetch /api/notes
  ▼
client (Vite dev server :5173)      ── proxies /api/* ──▶  server (Express :3001)
  React UI, i18n, client-side export                          NotesStore
                                                                  │
                                                                  ▼
                                                    server/data/notes.json
```

In production there is no proxy: `npm run build` compiles both workspaces and
`npm start` runs the API on `:3001`, which serves `client/dist` for every
non-`/api` route.

## Server

| File | Responsibility |
| --- | --- |
| `server/src/index.ts` | Process entry point: reads `PORT`/`HOST`/`NOTES_DATA_FILE`, decides whether `client/dist` exists, starts listening |
| `server/src/app.ts` | Express wiring: routes, security headers, JSON limit, static hosting, error translation |
| `server/src/notesStore.ts` | Domain logic: validation, ordering, and file persistence |
| `server/src/exportNotes.ts` | Pure rendering of notes to JSON or Markdown |

`createApp(store, options)` takes its store as an argument, so tests construct
an in-memory `NotesStore` (no `persistPath`) and never touch the disk.

### Error translation

`NotesStore` throws two typed errors and the Express error handler maps them to
status codes, which keeps HTTP concerns out of the domain layer:

- `ValidationError` → `400` with the thrown message.
- `PersistError` → `503` with the thrown message.
- Anything else → its own `status`/`statusCode` if it looks like an HTTP error
  (this is how Express' body parser surfaces `400` and `413`), otherwise `500`
  with a generic message and a server-side log.

### Persistence model

The store keeps notes in a `Map` and mirrors them to a JSON file:

- **Load once at startup.** A missing file is normal (fresh install). A file
  that is unreadable, not JSON, or not an array marks the store as failed.
- **Skip, don't discard.** Individual records that fail validation are skipped
  and the store is marked as failed, so valid notes remain readable while
  writes are refused. Nothing is ever silently dropped from the file.
- **Atomic writes.** Each write serializes the whole map to
  `<path>.<pid>.tmp` and renames it over the target, so a crash mid-write
  cannot leave a truncated file.
- **Rollback on failure.** If the write throws, the in-memory change is undone
  before the error propagates, so a `503` leaves no phantom note behind.

`persistStatus()` derives the three-way health value from those flags: `ok`
when nothing failed, `degraded` when a load failed but some notes survived, and
`unavailable` when a load failed and nothing survived.

Timestamps read from disk are re-canonicalized to UTC ISO-8601, so a
hand-edited file with mixed formats still sorts correctly and still renders the
right "edited" state.

## Client

| File | Responsibility |
| --- | --- |
| `client/src/main.tsx` | Mounts `<App />` in `React.StrictMode` |
| `client/src/App.tsx` | The entire UI: list, form, search, export, error handling |
| `client/src/api.ts` | `fetch` wrappers plus defensive parsing of API responses |
| `client/src/i18n.ts` | Locale detection, English/Arabic copy, search normalization |
| `client/src/exportNotes.ts` | Renders notes to JSON/Markdown and triggers a browser download |

### Trust boundary

`api.ts` re-validates everything the server sends: `parseNote` enforces the
same field types and length limits as the server, drops malformed records, and
canonicalizes timestamps. `parseNotes` also de-duplicates by id and throws
`ApiError("invalid notes response", 500)` when a non-empty response contains no
usable note, so a broken backend surfaces as an error instead of a silently
empty list.

`ApiError` carries the HTTP status, which `App.tsx` maps to a localized
message: `503` explains that saving is paused, `404` explains that the note is
gone (and offers to re-save it as a new note), `413` and `400` explain the size
and validation limits, and `TypeError`/`502`/`504` are treated as "the API is
unreachable".

### UI behavior worth knowing

- **Startup retries.** The initial load retries network failures with a linear
  backoff (8 attempts in the browser, 3 in tests) so the UI survives a Vite dev
  server that starts before the API.
- **Stale response guard.** Every refresh takes a ticket from a ref counter and
  discards its result if a newer refresh started in the meantime.
- **Single flight.** An `inFlightRef` blocks overlapping save, delete, retry,
  and export actions rather than relying on disabled buttons alone.
- **Unsaved-work guards.** Switching notes, cancelling, pressing `Escape`, or
  closing the tab all confirm first when the form is dirty.
- **Editing stays visible.** A note being edited is kept in the list even when
  the current search query no longer matches it.
- **Export is client-side.** The buttons export exactly the notes matching the
  current search, using the same renderer as the server's `/api/notes/export`.

### Localization and search

`detectLocale()` reads `navigator.languages[0]` (falling back to
`navigator.language`) and picks Arabic for any `ar` tag, otherwise English.
`App.tsx` then sets `document.documentElement.lang`/`dir`, so Arabic renders
right-to-left, and every text field uses `dir="auto"` so mixed content lines up
per note.

`normalizeForSearch()` makes search forgiving in both languages by stripping
tashkeel, tatweel, and Latin accents; folding alef, hamza-on-waw, alef maqsura
and Persian yeh/kaf, and teh marbuta variants; converting Eastern Arabic and
Persian digits to ASCII; and collapsing whitespace.

## Testing strategy

Both workspaces run Vitest.

- `server/src/app.test.ts` drives the real Express app through Supertest with an
  in-memory store, covering routes, validation, error mapping, and static
  hosting.
- `server/src/notesStore.test.ts` writes to temporary files to cover load
  failures, skipped records, atomic writes, and rollback.
- `client/src/App.test.tsx` renders the app with Testing Library against a
  mocked `fetch`, covering the full interaction surface.
- The remaining suites are unit tests for the pure modules (`api`, `i18n`,
  `exportNotes` on both sides).

Because the two `exportNotes` modules are intentionally duplicated (one for
Node, one for the browser bundle), each has its own suite; changing one output
format means changing both.
