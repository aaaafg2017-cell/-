# Contributing

Thanks for taking the time to contribute! This project is a small npm
workspaces monorepo (`client/` + `server/`); see
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces fit
together before making non-trivial changes.

## Getting set up

```bash
npm install
npm run dev   # API on :3001, client on :5173 (with live reload)
```

See the [README](README.md) for prerequisites, the full command list, and
the HTTP API reference.

## Before opening a pull request

Run the same checks CI runs (`.github/workflows/ci.yml`), from the repo root:

```bash
npm run typecheck   # tsc --noEmit for both workspaces
npm run lint        # ESLint across the repo
npm test            # Vitest for both workspaces
npm run build       # compiles server + client for production
```

All four must pass. Prefer adding or updating a test alongside any behavior
change — both workspaces use Vitest, and server tests use `supertest` to
exercise `createApp()` in-process (no real port bound, no real disk writes
unless a test explicitly opts in with a `persistPath`).

## Code style

- TypeScript everywhere; keep new code typed (avoid `any`) and let
  `npm run typecheck` catch mismatches.
- Match the existing formatting/lint rules (`eslint.config.js`); run
  `npm run lint` before committing.
- Keep server and client validation logic defensive and independent (see
  "Shared conventions" in `docs/ARCHITECTURE.md`) — the client should never
  assume the server response is well-formed, and the server should never
  assume the on-disk file is well-formed.
- If you touch user-facing copy, update both locales in
  `client/src/i18n.ts` (`en` and `ar`).

## Commit and PR conventions

- Write descriptive commit messages; keep unrelated changes in separate
  commits.
- Keep pull requests focused. Describe *what* changed and *why*, and call out
  any manual testing performed (or why it wasn't needed).
