export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  title: string;
  body?: unknown;
}

export const TITLE_MAX_LENGTH = 200;
export const BODY_MAX_LENGTH = 8000;

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

  create({ title, body }: CreateNoteInput): Note {
    const now = new Date().toISOString();
    const note: Note = {
      id: globalThis.crypto.randomUUID(),
      title: normalizeTitle(title),
      body: normalizeBody(body),
      createdAt: now,
      updatedAt: now,
    };
    this.notes.set(note.id, note);
    return note;
  }

  update(id: string, { title, body }: CreateNoteInput): Note | undefined {
    const existing = this.notes.get(id);
    if (!existing) {
      return undefined;
    }
    const updated: Note = {
      ...existing,
      title: normalizeTitle(title),
      body: normalizeBody(body),
      updatedAt: new Date().toISOString(),
    };
    this.notes.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.notes.delete(id);
  }

  clear(): void {
    this.notes.clear();
  }
}

export class ValidationError extends Error {}

function normalizeTitle(title: unknown): string {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (!trimmed) {
    throw new ValidationError("title is required");
  }
  if (trimmed.length > TITLE_MAX_LENGTH) {
    throw new ValidationError(`title must be at most ${TITLE_MAX_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeBody(body: unknown): string {
  if (typeof body !== "string") {
    return "";
  }
  const trimmed = body.trim();
  if (trimmed.length > BODY_MAX_LENGTH) {
    throw new ValidationError(`body must be at most ${BODY_MAX_LENGTH} characters`);
  }
  return trimmed;
}
