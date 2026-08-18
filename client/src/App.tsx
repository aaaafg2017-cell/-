import { useEffect, useState, type FormEvent } from "react";
import { createNote, deleteNote, fetchNotes, type Note } from "./api.ts";

export function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    try {
      await createNote({ title, body });
      setTitle("");
      setBody("");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteNote(id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>Notes</h1>
        <p className="app__subtitle">
          A tiny full-stack starter — React &amp; Vite talking to an Express API.
        </p>
      </header>

      <form className="note-form" onSubmit={handleSubmit}>
        <input
          className="note-form__input"
          placeholder="Note title"
          aria-label="Note title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="note-form__textarea"
          placeholder="Write something…"
          aria-label="Note body"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="note-form__button" type="submit">
          Add note
        </button>
      </form>

      {error && <p className="app__error" role="alert">{error}</p>}

      {loading ? (
        <p className="app__empty">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="app__empty">No notes yet. Create your first one above.</p>
      ) : (
        <ul className="note-list">
          {notes.map((note) => (
            <li key={note.id} className="note-card">
              <div className="note-card__content">
                <h2 className="note-card__title">{note.title}</h2>
                {note.body && <p className="note-card__body">{note.body}</p>}
                <time className="note-card__time" dateTime={note.createdAt}>
                  {new Date(note.createdAt).toLocaleString()}
                </time>
              </div>
              <button
                className="note-card__delete"
                aria-label={`Delete ${note.title}`}
                onClick={() => handleDelete(note.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
