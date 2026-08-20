# Notes App documentation

Reference documentation for the Notes app. Start with the root
[`README.md`](../README.md) for a five-minute quick start; use these pages when
you need the details.

| Page | What it covers |
| --- | --- |
| [Architecture](architecture.md) | How the client, API, and data file fit together; request flow; module map |
| [API reference](api.md) | Every endpoint, request/response shape, status code, and header |
| [Persistence](persistence.md) | The `notes.json` format, atomic writes, and the `ok`/`degraded`/`unavailable` states |
| [Frontend guide](frontend.md) | UI state machine, localization, search normalization, and export |
| [Development](development.md) | Setup, scripts, configuration, testing, CI, and troubleshooting |

Arabic quick start: [`README.ar.md`](../README.ar.md).

## Conventions used in these docs

- Paths are relative to the repository root.
- `client/` refers to the React + Vite workspace, `server/` to the Express + TypeScript workspace.
- Shell examples assume the API is reachable at `http://localhost:3001`.
