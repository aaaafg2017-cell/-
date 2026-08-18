import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createNote,
  deleteNote,
  fetchNotes,
  updateNote,
  type Note,
} from "./api.ts";
import { copy, detectLocale } from "./i18n.ts";

export const TITLE_MAX_LENGTH = 200;
export const BODY_MAX_LENGTH = 8000;

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

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.title = t.title;
  }, [locale, t.title]);

  async function refresh() {
    try {
      setNotes(await fetchNotes());
      setError(null);
      setLoadFailed(false);
    } catch (err) {
      setError((err as Error).message);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry() {
    setLoading(true);
    await refresh();
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visibleNotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return notes;
    }
    return notes.filter((note) => {
      return (
        note.title.toLowerCase().includes(needle) ||
        note.body.toLowerCase().includes(needle)
      );
    });
  }, [notes, query]);

  function startEdit(note: Note) {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) {
      return;
    }
    if (!title.trim()) {
      setError(t.titleRequired);
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateNote(editingId, { title, body });
        setEditingId(null);
      } else {
        await createNote({ title, body });
        setQuery("");
      }
      setTitle("");
      setBody("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(note: Note) {
    if (deletingId) {
      return;
    }
    if (!window.confirm(t.confirmDelete(note.title))) {
      return;
    }
    setDeletingId(note.id);
    try {
      await deleteNote(note.id);
      if (editingId === note.id) {
        cancelEdit();
      }
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>{t.title}</h1>
        <p className="app__subtitle">{t.subtitle}</p>
      </header>

      <form className="note-form" onSubmit={handleSubmit}>
        <input
          className="note-form__input"
          placeholder={t.titlePlaceholder}
          aria-label={t.titleLabel}
          dir="auto"
          value={title}
          maxLength={TITLE_MAX_LENGTH}
          disabled={saving}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="note-form__textarea"
          placeholder={t.bodyPlaceholder}
          aria-label={t.bodyLabel}
          dir="auto"
          rows={3}
          value={body}
          maxLength={BODY_MAX_LENGTH}
          disabled={saving}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="note-form__actions">
          {editingId && (
            <button
              className="note-form__cancel"
              type="button"
              onClick={cancelEdit}
              disabled={saving}
            >
              {t.cancel}
            </button>
          )}
          <button className="note-form__button" type="submit" disabled={saving}>
            {saving ? t.loading : editingId ? t.save : t.add}
          </button>
        </div>
      </form>

      {error && <p className="app__error" role="alert">{error}</p>}

      {loading ? (
        <p className="app__empty">{t.loading}</p>
      ) : notes.length === 0 && loadFailed ? (
        <div className="app__empty">
          <button
            className="note-form__button"
            type="button"
            onClick={() => void handleRetry()}
          >
            {t.retry}
          </button>
        </div>
      ) : notes.length === 0 ? (
        <p className="app__empty">{t.empty}</p>
      ) : (
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
                        {new Date(note.updatedAt).toLocaleString(
                          locale === "ar" ? "ar" : undefined,
                        )}
                        {edited ? ` · ${t.edited}` : ""}
                      </time>
                    </div>
                    <div className="note-card__actions">
                      <button
                        className="note-card__edit"
                        type="button"
                        onClick={() => startEdit(note)}
                        disabled={saving || deletingId === note.id}
                      >
                        {t.edit}
                      </button>
                      <button
                        className="note-card__delete"
                        type="button"
                        aria-label={t.delete(note.title)}
                        onClick={() => void handleDelete(note)}
                        disabled={saving || deletingId === note.id}
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
      )}
    </main>
  );
}
