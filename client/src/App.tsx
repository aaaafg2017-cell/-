import { useEffect, useState, type FormEvent } from "react";
import {
  createNote,
  deleteNote,
  fetchNotes,
  updateNote,
  type Note,
} from "./api.ts";
import { copy, detectLocale } from "./i18n.ts";

export function App() {
  const locale = detectLocale();
  const t = copy[locale];
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  async function refresh() {
    try {
      setNotes(await fetchNotes());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

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

  async function handleDelete(id: string) {
    if (deletingId) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteNote(id);
      if (editingId === id) {
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
      ) : notes.length === 0 ? (
        <p className="app__empty">{t.empty}</p>
      ) : (
        <ul className="note-list">
          {notes.map((note) => (
            <li key={note.id} className="note-card">
              <div className="note-card__content">
                <h2 className="note-card__title" dir="auto">{note.title}</h2>
                {note.body && (
                  <p className="note-card__body" dir="auto">{note.body}</p>
                )}
                <time className="note-card__time" dateTime={note.createdAt}>
                  {new Date(note.createdAt).toLocaleString(locale === "ar" ? "ar" : undefined)}
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
                  onClick={() => handleDelete(note.id)}
                  disabled={saving || deletingId === note.id}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
