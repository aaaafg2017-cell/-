import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  createNote,
  deleteNote,
  fetchNotes,
  updateNote,
  type Note,
} from "./api.ts";
import { copy, detectLocale } from "./i18n.ts";

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
  const refreshId = useRef(0);
  const editingIdRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);

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
        setError(isNetworkError(err) ? t.networkError : (err as Error).message);
        setLoadFailed(true);
        break;
      }
    }
    if (id === refreshId.current) {
      setLoading(false);
    }
  }

  async function handleRetry() {
    if (notes.length === 0) {
      setLoading(true);
    }
    await refresh(INITIAL_LOAD_RETRIES);
  }

  useEffect(() => {
    void refresh(INITIAL_LOAD_RETRIES);
  }, []);

  const visibleNotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notes.filter((note) => {
      if (editingId === note.id) {
        return true;
      }
      if (!needle) {
        return true;
      }
      return (
        note.title.toLowerCase().includes(needle) ||
        note.body.toLowerCase().includes(needle)
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
    if (editingId === note.id && title === note.title && body === note.body) {
      return;
    }
    if (!confirmDiscard()) {
      return;
    }
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setError(null);
  }

  function cancelEdit() {
    editingIdRef.current = null;
    isDirtyRef.current = false;
    setEditingId(null);
    setTitle("");
    setBody("");
    setError(null);
  }

  function requestCancelEdit() {
    if (!editingIdRef.current) {
      return;
    }
    if (!confirmDiscard()) {
      return;
    }
    cancelEdit();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !editingIdRef.current) {
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
    if (saving || deletingId) {
      return;
    }
    if (!title.trim()) {
      setError(t.titleRequired);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateNote(editingId, { title, body });
        setNotes((current) => upsertNote(current, updated));
        setEditingId(null);
      } else {
        const created = await createNote({ title, body });
        setNotes((current) => upsertNote(current, created));
      }
      setQuery("");
      setTitle("");
      setBody("");
      await refresh();
    } catch (err) {
      setError(isNetworkError(err) ? t.networkError : (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(note: Note) {
    if (deletingId || saving) {
      return;
    }
    if (!window.confirm(t.confirmDelete(note.title))) {
      return;
    }
    setError(null);
    setDeletingId(note.id);
    try {
      await deleteNote(note.id);
      setNotes((current) => current.filter((item) => item.id !== note.id));
      if (editingId === note.id) {
        cancelEdit();
      }
      await refresh();
    } catch (err) {
      setError(isNetworkError(err) ? t.networkError : (err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  const showList = !loading && notes.length > 0;
  const showEmpty = !loading && notes.length === 0 && !loadFailed;
  const formLocked = saving || Boolean(deletingId);

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
          {editingId && (
            <button
              className="note-form__cancel"
              type="button"
              onClick={requestCancelEdit}
              disabled={formLocked}
            >
              {t.cancel}
            </button>
          )}
          <button className="note-form__button" type="submit" disabled={formLocked}>
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
          <label className="app__search">
            <span className="visually-hidden">{t.searchLabel}</span>
            <input
              className="note-form__input"
              type="search"
              placeholder={t.searchPlaceholder}
              aria-label={t.searchLabel}
              dir="auto"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
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
