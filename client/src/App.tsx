import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  createNote,
  deleteNote,
  fetchNotes,
  updateNote,
  type Note,
} from "./api.ts";
import { copy, detectLocale, normalizeForSearch, type Locale } from "./i18n.ts";
import { exportNotes } from "./exportNotes.ts";

export const TITLE_MAX_LENGTH = 200;
export const BODY_MAX_LENGTH = 8000;
const INITIAL_LOAD_RETRIES = import.meta.env.MODE === "test" ? 3 : 8;
const INITIAL_RETRY_DELAY_MS = import.meta.env.MODE === "test" ? 5 : 200;

function upsertNote(notes: Note[], note: Note): Note[] {
  return [note, ...notes.filter((item) => item.id !== note.id)].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) {
    return true;
  }
  return err instanceof ApiError && (err.status === 502 || err.status === 504);
}

function errorMessage(err: unknown, t: (typeof copy)[Locale]): string {
  if (isNetworkError(err)) {
    return t.networkError;
  }
  if (err instanceof ApiError) {
    if (err.status === 503) {
      return t.persistError;
    }
    if (err.status === 404) {
      return t.notFound;
    }
    if (err.status === 413) {
      return t.tooLarge;
    }
    if (err.status === 400) {
      const msg = err.message.toLowerCase();
      if (msg.includes("title is required")) {
        return t.titleRequired;
      }
      if (msg.includes("title must be at most")) {
        return t.titleTooLong;
      }
      if (msg.includes("body must be at most")) {
        return t.bodyTooLong;
      }
      return t.invalidRequest;
    }
  }
  return err instanceof Error ? err.message : t.networkError;
}

function formatTimestamp(iso: string, locale: ReturnType<typeof detectLocale>): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(locale === "ar" ? "ar" : undefined);
}

export function App() {
  const locale = detectLocale();
  const t = copy[locale];
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const refreshId = useRef(0);
  const editingIdRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const loadFailedRef = useRef(false);
  loadFailedRef.current = loadFailed;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.title = t.title;
  }, [locale, t.title]);

  async function refresh(retries = 0) {
    const id = ++refreshId.current;
    for (let attempt = 0; ; attempt += 1) {
      try {
        const next = await fetchNotes();
        if (id !== refreshId.current) {
          return;
        }
        setNotes(next);
        setError(null);
        setLoadFailed(false);
        break;
      } catch (err) {
        if (id !== refreshId.current) {
          return;
        }
        if (isNetworkError(err) && attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, INITIAL_RETRY_DELAY_MS * (attempt + 1)),
          );
          if (id !== refreshId.current) {
            return;
          }
          continue;
        }
        setError(errorMessage(err, t));
        setLoadFailed(true);
        break;
      }
    }
    if (id === refreshId.current) {
      setLoading(false);
    }
  }

  async function handleRetry() {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    try {
      if (notes.length === 0) {
        setLoading(true);
      }
      await refresh(INITIAL_LOAD_RETRIES);
    } finally {
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    void refresh(INITIAL_LOAD_RETRIES);
  }, []);

  const visibleNotes = useMemo(() => {
    const needle = normalizeForSearch(query.trim());
    return notes.filter((note) => {
      if (editingId === note.id) {
        return true;
      }
      if (!needle) {
        return true;
      }
      return (
        normalizeForSearch(note.title).includes(needle) ||
        normalizeForSearch(note.body).includes(needle)
      );
    });
  }, [notes, query, editingId]);

  const isDirty = useMemo(() => {
    if (editingId) {
      const current = notes.find((note) => note.id === editingId);
      if (!current) {
        return true;
      }
      return title.trim() !== current.title || body.trim() !== current.body;
    }
    return title.trim() !== "" || body.trim() !== "";
  }, [body, editingId, notes, title]);
  editingIdRef.current = editingId;
  isDirtyRef.current = isDirty;

  function confirmDiscard(): boolean {
    if (!isDirtyRef.current) {
      return true;
    }
    return window.confirm(t.discardChanges);
  }

  function startEdit(note: Note) {
    if (inFlightRef.current) {
      return;
    }
    if (editingId === note.id && title === note.title && body === note.body) {
      return;
    }
    if (!confirmDiscard()) {
      return;
    }
    editingIdRef.current = note.id;
    isDirtyRef.current = false;
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
    if (!loadFailedRef.current) {
      setError(null);
    }
  }

  function cancelEdit() {
    editingIdRef.current = null;
    isDirtyRef.current = false;
    setEditingId(null);
    setTitle("");
    setBody("");
    if (!loadFailedRef.current) {
      setError(null);
    }
  }

  function requestCancelEdit() {
    if (inFlightRef.current) {
      return;
    }
    if (!editingIdRef.current && !isDirtyRef.current) {
      return;
    }
    if (!confirmDiscard()) {
      return;
    }
    cancelEdit();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (!editingIdRef.current && !isDirtyRef.current) {
        return;
      }
      event.preventDefault();
      requestCancelEdit();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [t.discardChanges]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (inFlightRef.current || loading || saving || deletingId) {
      return;
    }
    if (!title.trim()) {
      setError(t.titleRequired);
      return;
    }
    if (editingId && !isDirtyRef.current) {
      return;
    }
    setError(null);
    inFlightRef.current = true;
    setSaving(true);
    const payload = { title: title.trim(), body: body.trim() };
    try {
      if (editingId) {
        const updated = await updateNote(editingId, payload);
        setNotes((current) => upsertNote(current, updated));
      } else {
        const created = await createNote(payload);
        setNotes((current) => upsertNote(current, created));
      }
      editingIdRef.current = null;
      isDirtyRef.current = false;
      setEditingId(null);
      setQuery("");
      setTitle("");
      setBody("");
      await refresh(INITIAL_LOAD_RETRIES);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && editingId) {
        const missingId = editingId;
        editingIdRef.current = null;
        isDirtyRef.current = true;
        setEditingId(null);
        setNotes((current) => current.filter((item) => item.id !== missingId));
        setError(t.notFoundRecreate);
      } else {
        setError(errorMessage(err, t));
      }
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }

  function handleExport() {
    if (loading || notes.length === 0 || formLocked) {
      return;
    }
    exportNotes({ notes });
    setExportMessage(t.exportSuccess(notes.length));
    setError(null);
  }

  async function handleDelete(note: Note) {
    if (inFlightRef.current || deletingId || saving) {
      return;
    }
    if (!window.confirm(t.confirmDelete(note.title))) {
      return;
    }
    if (inFlightRef.current) {
      return;
    }
    setError(null);
    inFlightRef.current = true;
    setDeletingId(note.id);
    try {
      await deleteNote(note.id);
      setNotes((current) => current.filter((item) => item.id !== note.id));
      if (editingIdRef.current === note.id) {
        cancelEdit();
      }
      await refresh(INITIAL_LOAD_RETRIES);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotes((current) => current.filter((item) => item.id !== note.id));
        if (editingIdRef.current === note.id) {
          cancelEdit();
        }
        setError(t.notFound);
      } else {
        setError(errorMessage(err, t));
      }
    } finally {
      inFlightRef.current = false;
      setDeletingId(null);
    }
  }

  const showList = !loading && notes.length > 0;
  const showEmpty = !loading && notes.length === 0 && !loadFailed;
  const formLocked = saving || Boolean(deletingId);
  const submitLocked = formLocked || loading;

  return (
    <main className="app">
      <header className="app__header">
        <h1>{t.title}</h1>
        <p className="app__subtitle">{t.subtitle}</p>
      </header>

      <form
        className="note-form"
        onSubmit={handleSubmit}
        aria-busy={formLocked || loading}
        aria-describedby={error ? "app-error" : undefined}
      >
        <input
          className="note-form__input"
          placeholder={t.titlePlaceholder}
          aria-label={t.titleLabel}
          aria-invalid={!title.trim() && error === t.titleRequired}
          autoComplete="off"
          dir="auto"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          disabled={formLocked}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error === t.titleRequired) {
              setError(null);
            }
          }}
        />
        <textarea
          className="note-form__textarea"
          placeholder={t.bodyPlaceholder}
          aria-label={t.bodyLabel}
          autoComplete="off"
          dir="auto"
          rows={3}
          value={body}
          maxLength={BODY_MAX_LENGTH}
          disabled={formLocked}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="note-form__actions">
          {(editingId || isDirty) && (
            <button
              className="note-form__cancel"
              type="button"
              onClick={requestCancelEdit}
              disabled={formLocked}
            >
              {t.cancel}
            </button>
          )}
          <button
            className="note-form__button"
            type="submit"
            disabled={submitLocked || Boolean(editingId && !isDirty)}
          >
            {saving ? t.loading : editingId ? t.save : t.add}
          </button>
        </div>
      </form>

      {error && (
        <p className="app__error" role="alert" id="app-error">
          {error}
        </p>
      )}

      {loadFailed && !loading && (
        <div className="app__retry">
          <button
            className="note-form__button"
            type="button"
            onClick={() => void handleRetry()}
            disabled={formLocked}
          >
            {t.retry}
          </button>
        </div>
      )}

      {loading ? (
        <p className="app__empty">{t.loading}</p>
      ) : showEmpty ? (
        <p className="app__empty">{t.empty}</p>
      ) : showList ? (
        <>
          <div className="app__toolbar">
            <label className="app__search">
              <span className="visually-hidden">{t.searchLabel}</span>
              <input
                className="note-form__input"
                type="search"
                placeholder={t.searchPlaceholder}
                aria-label={t.searchLabel}
                dir="auto"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (exportMessage) {
                    setExportMessage(null);
                  }
                }}
              />
            </label>
            <button
              className="app__export"
              type="button"
              onClick={handleExport}
              disabled={formLocked}
            >
              {t.export}
            </button>
          </div>
          {exportMessage && (
            <p className="app__status" role="status">
              {exportMessage}
            </p>
          )}
          {visibleNotes.length === 0 ? (
            <p className="app__empty">{t.noResults}</p>
          ) : (
            <ul className="note-list">
              {visibleNotes.map((note) => {
                const edited = note.updatedAt !== note.createdAt;
                return (
                  <li
                    key={note.id}
                    className={
                      editingId === note.id
                        ? "note-card note-card--editing"
                        : "note-card"
                    }
                  >
                    <div className="note-card__content">
                      <h2 className="note-card__title" dir="auto">{note.title}</h2>
                      {note.body && (
                        <p className="note-card__body" dir="auto">{note.body}</p>
                      )}
                      <time className="note-card__time" dateTime={note.updatedAt}>
                        {formatTimestamp(note.updatedAt, locale)}
                        {edited ? ` · ${t.edited}` : ""}
                      </time>
                    </div>
                    <div className="note-card__actions">
                      <button
                        className="note-card__edit"
                        type="button"
                        aria-label={t.editNote(note.title)}
                        onClick={() => startEdit(note)}
                        disabled={formLocked}
                      >
                        {t.edit}
                      </button>
                      <button
                        className="note-card__delete"
                        type="button"
                        aria-label={t.delete(note.title)}
                        onClick={() => void handleDelete(note)}
                        disabled={formLocked}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </main>
  );
}
