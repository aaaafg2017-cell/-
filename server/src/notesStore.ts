export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface CreateNoteInput {
  title: string;
  body?: string;
}

/**
 * Simple in-memory notes store. Kept dependency-free so the starter runs
 * anywhere without a database; swap this out for a real datastore as the
 * project grows.
 */
export class NotesStore {
  private notes = new Map<string, Note>();

  list(): Note[] {
    return [...this.notes.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  get(id: string): Note | undefined {
    return this.notes.get(id);
  }

  create({ title, body = "" }: CreateNoteInput): Note {
    const trimmed = typeof title === "string" ? title.trim() : "";
    if (!trimmed) {
      throw new ValidationError("title is required");
    }
    const note: Note = {
      id: globalThis.crypto.randomUUID(),
      title: trimmed,
      body: typeof body === "string" ? body.trim() : "",
      createdAt: new Date().toISOString(),
    };
    this.notes.set(note.id, note);
    return note;
  }

  delete(id: string): boolean {
    return this.notes.delete(id);
  }

  clear(): void {
    this.notes.clear();
  }
}

export class ValidationError extends Error {}
