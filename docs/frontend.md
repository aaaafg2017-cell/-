# Frontend guide

The UI is a single React component, `client/src/App.tsx`, backed by three small
modules: `api.ts` (typed fetch client), `i18n.ts` (locale + copy + search
normalization), and `exportNotes.ts` (client-side export). There is no router
and no state library — the app has one screen and the API is the single source
of truth.

## State

| State | Purpose |
| --- | --- |
| `notes` | Everything the API returned, sorted newest-first |
| `title`, `body` | The form, which doubles as the create form and the edit form |
| `editingId` | `null` while creating; a note id while editing |
| `query` | The search box |
| `loading`, `saving`, `deletingId`, `loadFailed`, `error` | Request and error flags that drive the disabled states and messages |

Three derived lists sit on top of `notes`:

- `matchingNotes` — `notes` filtered by the normalized search query. This is what
  the export buttons export.
- `visibleNotes` — `matchingNotes` plus the note currently being edited, so
  typing a title that no longer matches the query does not make the card you are
  editing disappear.
- `isDirty` — whether the form differs (after trimming) from the note being
  edited, or is non-empty when creating.

## Request handling

**One mutation at a time.** An `inFlightRef` guard, plus `disabled` attributes
driven by `saving`/`deletingId`, prevent double submits and prevent deleting a
note while another request is running.

**Stale responses are dropped.** Each `refresh()` increments a counter and
ignores its own result if a newer refresh started meanwhile.

**The first load retries.** Network failures during load are retried up to eight
times with a linearly growing delay (200ms, 400ms, 600ms, …), which covers the
common case of the UI starting before the API. After that the user gets an error
and a "Try again" button. In test mode the retry counts and delays shrink so the
suite stays fast.

**Errors are translated, not echoed.** `errorMessage()` maps a failure to
localized copy: a `TypeError` from `fetch` or a `502`/`504` from the dev proxy
becomes "Could not reach the notes API", `503` becomes the persistence message,
`404` "that note no longer exists", `413` "too large", and `400` is matched
against the server's validation messages to pick the specific hint.

**Responses are re-validated.** `api.ts` parses every note it receives, drops
duplicates by id, and re-sorts. A response that is JSON but not a list of notes
raises `ApiError("invalid notes response", 500)` rather than rendering garbage.

## Unsaved-changes guards

Losing a half-written note is the worst thing this app could do, so there are
four guards, all routed through the same `confirmDiscard()`:

- Clicking **Edit** on a different note while the form is dirty.
- Clicking **Cancel**.
- Pressing **Escape** (bound on `window` in the capture phase, so it works from
  inside the inputs).
- Closing or reloading the tab (`beforeunload`, registered only while dirty).

Deleting always asks first, quoting the note's title.

One more edge case: if you save an edit to a note that was deleted elsewhere, the
API answers `404`. Instead of throwing the text away, the app clears `editingId`,
keeps your form contents, and tells you to save again to keep it as a new note.

## Localization and RTL

`detectLocale()` reads `navigator.languages[0]` (falling back to
`navigator.language`) and returns `ar` for `ar` and `ar-*`, otherwise `en`. All
copy lives in the `copy` object in `i18n.ts`.

Direction is applied twice on purpose. An inline script in `client/index.html`
sets `<html lang>`, `<html dir>`, and the document title before the bundle loads,
so an Arabic user never sees a flash of left-to-right layout; an effect in
`App.tsx` then keeps them in sync. Layout is symmetric flexbox, so `dir="rtl"`
mirrors it without extra CSS, and the font stack includes Noto Sans/Naskh Arabic.

Note text is rendered with `dir="auto"` in the inputs and on every title and
body, so an Arabic note in an English UI (or the reverse) still reads correctly.

To add a locale: extend the `Locale` union, add a full entry to `copy`, and teach
`detectLocale()` about the new language tag. TypeScript will flag any missing
key.

## Search

`normalizeForSearch()` in `i18n.ts` is applied to both the query and each note's
title and body, so search is substring-based but forgiving. It:

- lowercases and strips Latin diacritics via NFKD (`Café` matches `cafe`);
- strips Arabic tashkeel, superscript alef, and Quranic marks, and removes
  tatweel (`مُحَمَّد` and `محـمد` match `محمد`);
- folds alef variants (`أ إ آ ٱ` → `ا`), hamza on waw (`ؤ` → `و`), yeh variants
  and alef maqsura (`ئ ى ی` → `ي`), Persian kaf (`ک` → `ك`), and teh marbuta
  (`ة` → `ه`);
- converts Arabic-Indic (`٠-٩`) and Extended Arabic-Indic (`۰-۹`) digits to ASCII;
- collapses runs of whitespace and trims.

Searching does not hit the API; it filters the list already in memory.

## Export

The toolbar's two buttons render the **currently filtered** notes — search first,
then export, and you get only what you see. (The API's
`GET /api/notes/export` always exports everything.)

`renderNotesExport()` produces the same JSON envelope and Markdown layout as the
server, `downloadText()` wraps it in a `Blob` and clicks a temporary anchor, and
the object URL is revoked on a later tick because Firefox cancels the download if
it is revoked in the same turn. Browsers without `URL.createObjectURL` get a
localized error instead of a silent failure. The buttons are disabled when the
filtered list is empty.

## Accessibility

- Every control has a label: `aria-label` on the inputs, a visually hidden
  `<span>` for the search field, and per-note labels such as "Delete Buy milk"
  so screen-reader users can tell the row buttons apart.
- Errors render in a `role="alert"` region that the form points at with
  `aria-describedby`; the form sets `aria-busy` while a request is running.
- Timestamps use `<time dateTime={updatedAt}>` with a locale-formatted label and
  an "edited" suffix when `updatedAt` differs from `createdAt`.
- All interactive elements have visible `:focus-visible` outlines, and disabled
  states are conveyed by the `disabled` attribute rather than styling alone.
