# Architecture

This document describes how the Notes App is put together: the responsibility
of each module, how data flows between the client and the server, and the
conventions used for persistence, errors, and internationalization. See the
top-level [README](../README.md) for setup and the HTTP API summary.

## Overview

The repository is an npm workspaces monorepo with two packages:

```
client/   React + Vite + TypeScript single-page app
server/   Express + TypeScript REST API with file-backed storage
```

In development, Vite (`client/`) serves the UI on port `5173` and proxies
`/api/*` requests to the Express API (`server/`) on port `3001` (see
`client/vite.config.ts`). In production, the API process serves the compiled
client as static files and the app runs from a single origin
(`server/src/index.ts`).

```
Browser
  │  fetch('/api/...')
  ▼
Vite dev server (5173)  ──proxy──▶  Express API (3001)
        (dev only)                        │
                                           ▼
                                 server/data/notes.json
```

## Server (`server/src/`)

| Module | Responsibility |
| --- | --- |
| `index.ts` | Process entry point: reads `PORT`/`HOST`/`NOTES_DATA_FILE` env vars, builds a `NotesStore`, decides whether to serve the built client, and starts `http.Server`. |
| `app.ts` | Builds the Express app: middleware, routes, static file serving, and the centralized error handler. Exported as `createApp(store, options)` so tests can inject an in-memory store. |
| `notesStore.ts` | The domain/persistence layer. Owns note validation, in-memory storage, and atomic disk writes. |
| `exportNotes.ts` | Pure functions that render a list of notes as a JSON or Markdown export payload. Shared shape with the client's copy of the same logic. |

### `NotesStore`

`NotesStore` (`server/src/notesStore.ts`) is the single source of truth for
notes. Key design points:

- **In-memory by default.** Without a `persistPath`, it behaves like a plain
  in-memory store, which keeps unit tests fast and isolated.
- **Optional file persistence.** When constructed with a path (the server
  passes `NOTES_DATA_FILE`, defaulting to `server/data/notes.json`), every
  mutation (`create`, `update`, `delete`, `clear`) is followed by a write to
  disk.
- **Atomic writes.** Writes go to a `<file>.<pid>.tmp` sibling, then
  `renameSync` swaps it into place. If the write fails, the temp file is
  cleaned up and the in-memory mutation is rolled back via
  `commitOrRollback`, so the in-memory state and on-disk state never diverge.
- **Never overwrite a bad file.** If the data file is missing it is treated
  as "no notes yet" (fresh install). If it exists but is unreadable,
  malformed JSON, not an array, or contains invalid records (bad dates,
  duplicate ids, empty/too-long titles, etc.), the store loads whatever
  valid notes it can but sets `loadFailed = true` and refuses all further
  writes (`refuseWritesIfNeeded`) so a corrupt file is never silently
  replaced.
- **Health reporting.** `persistStatus()` reflects this: `"ok"` normally,
  `"degraded"` when some notes loaded despite invalid records, and
  `"unavailable"` when nothing could be loaded at all. `GET /api/health`
  surfaces this, and reads (`list`/`get`) throw `PersistError` (→ HTTP `503`)
  when the status is `"unavailable"`.
- **Validation.** `ValidationError` is thrown for bad input (missing/oversized
  title, oversized body) and mapped to HTTP `400` in `app.ts`. Titles are
  required and trimmed to at most `TITLE_MAX_LENGTH` (200) characters, bodies
  are optional and trimmed to at most `BODY_MAX_LENGTH` (8000) characters.
- **Timestamp normalization.** Every note's `createdAt`/`updatedAt` is
  canonicalized to UTC ISO-8601 on load and on write (`canonicalIso`), so a
  data file edited by hand or produced by a different locale still sorts and
  displays correctly.

### `app.ts` request lifecycle

1. Global middleware: disable `X-Powered-By`, enable CORS, parse JSON bodies
   (`options.jsonLimit`, default `256kb`).
2. `/api/*` responses get `Cache-Control: no-store` and
   `X-Content-Type-Options: nosniff`.
3. Routes call into `NotesStore` / `exportNotes.ts` and translate results to
   HTTP responses (`404` for missing notes, `201` for creation, `204` for
   deletion, etc.).
4. Unmatched `/api/*` routes return a JSON `404` (instead of falling through
   to the static handler or Express's default HTML error page).
5. If `options.staticDir` is set (production), static assets are served with
   long-lived caching for hashed files under `assets/`, and any other GET/HEAD
   request without a file extension falls back to `index.html` (SPA routing)
   with `Cache-Control: no-store` so the shell itself is always revalidated.
   Requests for missing hashed assets or favicons (paths with an extension)
   `404` instead of silently serving the SPA shell.
6. A single error-handling middleware maps `ValidationError` → `400`,
   `PersistError` → `503`, and body-parser errors → `400`/`413`; anything else
   is logged and returned as a generic `500`.

## Client (`client/src/`)

| Module | Responsibility |
| --- | --- |
| `main.tsx` | React root bootstrap. |
| `App.tsx` | Top-level component: local state, data fetching/retry, optimistic UI, form validation, search, export actions, and the RTL-aware layout. |
| `api.ts` | Typed `fetch` wrapper around the REST API. Parses and validates every server response defensively (`parseNote`/`parseNotes`) before trusting it, and normalizes API errors into `ApiError`. |
| `exportNotes.ts` | Client-side mirror of the server's export rendering, plus `downloadText`, which triggers a browser file download via an object URL. |
| `i18n.ts` | Locale detection (`ar` vs `en`) from `navigator.language`, the `copy` dictionary for both locales, and `normalizeForSearch`, a Unicode-aware normalizer used for search matching. |

### Data flow and resilience in `App.tsx`

- On mount, `refresh()` calls `fetchNotes()` and retries transient network
  failures (detected via `isNetworkError`, i.e. `TypeError` or an `ApiError`
  with status `502`/`504`) up to `INITIAL_LOAD_RETRIES` times with linearly
  increasing backoff. This absorbs the brief window where the Vite proxy
  returns `502` before the API has finished starting.
  `INITIAL_LOAD_RETRIES`/`INITIAL_RETRY_DELAY_MS` are reduced in the `test`
  Vite mode so tests do not wait on real timers.
- Mutations (`create`/`update`/`delete`) optimistically update local state
  (`upsertNote`) and then call `refresh()` again to reconcile with the
  server.
- If an update/delete targets a note the server has since deleted (`404`),
  the client removes it locally and surfaces a "no longer exists" /
  "recreate" message rather than treating it as a hard failure.
- `errorMessage()` maps `ApiError` status codes and known validation messages
  to localized, user-facing copy (`i18n.ts`'s `copy` table) instead of
  showing raw server text.
- Unsaved-edit protection: `isDirty` tracks whether the form differs from the
  note being edited (or is non-empty for a new note). Escape and the cancel
  button confirm discarding via `window.confirm`, and a `beforeunload`
  listener warns on tab close/navigation while dirty.
- Search (`matchingNotes`) filters over `normalizeForSearch(title/body)` so
  Arabic letter variants (alef/hamza forms, presentation forms of yeh/kaf,
  tashkeel/tatweel), Eastern Arabic and Extended Arabic-Indic digits, and
  Latin diacritics all match their canonical form. The note being edited is
  always kept visible (`visibleNotes`) even if it no longer matches the
  query, so in-progress edits are never hidden.
- Export buttons call `renderNotesExport` (client copy) on the currently
  *visible/matching* notes and trigger a download via `downloadText`; export
  failures (e.g. `URL.createObjectURL` unsupported) are caught and reported
  through `error` state rather than throwing.

### Internationalization

`i18n.ts` detects locale purely from `navigator.language`/`navigator.languages`
(no user-facing language switcher yet). `App.tsx` sets
`document.documentElement.lang`/`dir` accordingly so Arabic renders
right-to-left. Text inputs use `dir="auto"` so mixed Arabic/Latin content
still displays with the correct per-field direction regardless of the page
direction.

## Shared conventions

- **Duplication is intentional in a couple of places.** `notesStore.ts`'s
  `asNote`/`canonicalIso` and `client/src/api.ts`'s `parseNote`/`canonicalIso`
  independently validate the same shape on each side of the wire — the
  server never trusts what's on disk, and the client never trusts what the
  server returns. Likewise `server/src/exportNotes.ts` and
  `client/src/exportNotes.ts` implement the same export rendering so the
  server's `/api/notes/export` endpoint and the client's "export visible
  notes" button produce byte-identical output.
- **Errors carry HTTP semantics end-to-end.** Server-side `ValidationError`/
  `PersistError` become specific status codes; the client's `ApiError` carries
  that status back into the UI so `errorMessage()` can react to it precisely
  (e.g. `503` → "saving is paused", `404` → "no longer exists").
- **Tests live next to the code they cover** (`*.test.ts`/`*.test.tsx`) and
  run under Vitest for both workspaces; server tests additionally use
  `supertest` to exercise `createApp()` over HTTP without binding a real
  port.
