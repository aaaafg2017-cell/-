# Persistence

Notes live in a single JSON file. `NotesStore` keeps an in-memory `Map` as the
working copy and mirrors it to disk after every successful mutation.

## Where the file lives

| | |
| --- | --- |
| Default path | `server/data/notes.json` |
| Override | `NOTES_DATA_FILE` (absolute or relative to the process working directory) |
| Created | Lazily, on the first write; the parent directory is created recursively |
| Git | `data/` is in `.gitignore`, so real notes are never committed |

Passing no path at all (`new NotesStore()`) gives a purely in-memory store. That
is what the test suites use, and it is why tests never touch your notes.

The dev server's file watcher excludes `./data`, `./data/**`, and `**/*.tmp`, so
saving a note does not restart the API.

## File format

A plain JSON array of notes — not the envelope that `/api/notes/export`
produces. It is written pretty-printed with two-space indentation and sorted by
`updatedAt`, newest first.

```json
[
  {
    "id": "0f3c4c9e-1b3a-4a2c-9f0f-2f4f8b6f1a77",
    "title": "Buy milk",
    "body": "2 liters",
    "createdAt": "2026-08-20T06:42:00.000Z",
    "updatedAt": "2026-08-20T06:42:00.000Z"
  }
]
```

To restore from a JSON export, unwrap the `notes` array first:

```bash
jq '.notes' notes-2026-08-20.json > server/data/notes.json
```

## Reading at startup

The file is read once, in the `NotesStore` constructor. Each record must have a
non-empty string `id`, string `title` and `body`, and a parseable `createdAt`.
`updatedAt` falls back to `createdAt` when absent. Both timestamps are
re-serialized to UTC ISO-8601, so a file written with local-time or
non-canonical timestamps still sorts correctly and still shows the right
"edited" state.

A record is skipped when it is not an object, is missing or mistypes a required
field, has an unparseable date, has an empty or over-length title, has an
over-length body, or repeats an `id` already seen (first one wins).

## Health states

`GET /api/health` reports one of three states.

| State | Cause | Reads | Writes |
| --- | --- | --- | --- |
| `ok` | The file loaded cleanly, or does not exist yet | allowed | allowed |
| `degraded` | Some records were skipped | allowed, for the valid subset | refused with `503` |
| `unavailable` | Nothing could be loaded: unreadable file, invalid JSON, or a top-level value that is not an array | refused with `503` | refused with `503` |

A missing file is not a failure; it is an empty store.

The rule behind all of this: **the store never overwrites a file it could not
fully read.** Rewriting a `degraded` file would silently delete the records that
failed to parse, so writes stop until a human repairs the file. The error
messages say so explicitly — `notes data file has invalid records; refusing to
overwrite it` and `notes data file could not be loaded; refusing to overwrite
it`.

Because the file is read only at startup, recovering from `degraded` or
`unavailable` means fixing the file and restarting the API.

## Writing

Every mutation follows the same sequence:

1. Validate and normalize the input (`ValidationError` → `400` if it fails).
2. Refuse the write outright if the store is `degraded` or `unavailable`.
3. Apply the change to the in-memory map.
4. Serialize the whole map to `<path>.<pid>.tmp`, then `rename()` it over the
   real file. The rename is atomic on POSIX filesystems, so a crash mid-write
   leaves either the old file or the new one, never a truncated one.
5. If any of that throws, delete the temp file, roll the in-memory change back,
   and raise a `PersistError` → `503`.

Step 5 is what keeps memory and disk in agreement: a client that gets a `503`
knows its change did not happen, in memory or on disk.

Two consequences of the whole-file write: throughput is fine for a personal note
list but not for high write rates, and two processes pointed at the same file
will clobber each other. Run one API process per data file.

## Operational notes

**Backups.** Copy the file, or use the export endpoint:

```bash
cp server/data/notes.json "backup-$(date +%F).json"
curl -sOJ http://localhost:3001/api/notes/export
```

**Repairing a broken file.** Validate it, fix or remove the offending records,
then restart the API:

```bash
jq . server/data/notes.json > /dev/null   # prints the parse error and its offset
```

The server also logs what it skipped at startup, for example
`Skipped 2 invalid note(s) in …; refusing to overwrite`.

**Starting clean.** Stop the API, move the file aside (do not just empty it if
you might want the contents back), and start again — a missing file loads as an
empty store.
