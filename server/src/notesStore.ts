import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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

export interface UpdateNoteInput {
  title?: unknown;
  body?: unknown;
}

export const TITLE_MAX_LENGTH = 200;
export const BODY_MAX_LENGTH = 8000;

/**
 * Notes store with optional JSON-file persistence. In-memory by default so
 * tests stay isolated; pass `persistPath` (or NOTES_DATA_FILE) so restarts
 * do not wipe user data.
 */
export class NotesStore {
  private notes = new Map<string, Note>();

  constructor(private persistPath?: string) {
    this.loadFromDisk();
  }

  list(): Note[] {
    return [...this.notes.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
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
    this.saveToDisk();
    return note;
  }

  update(id: string, input: UpdateNoteInput): Note | undefined {
    const existing = this.notes.get(id);
    if (!existing) {
      return undefined;
    }
    const hasTitle = Object.hasOwn(input, "title") && input.title !== undefined;
    const hasBody = Object.hasOwn(input, "body") && input.body !== undefined;
    if (!hasTitle && !hasBody) {
      throw new ValidationError("title or body is required");
    }
    const updated: Note = {
      ...existing,
      title: hasTitle ? normalizeTitle(input.title) : existing.title,
      body: hasBody ? normalizeBody(input.body) : existing.body,
      updatedAt: new Date().toISOString(),
    };
    this.notes.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  delete(id: string): boolean {
    const deleted = this.notes.delete(id);
    if (deleted) {
      this.saveToDisk();
    }
    return deleted;
  }

  clear(): void {
    this.notes.clear();
    this.saveToDisk();
  }

  private loadFromDisk(): void {
    if (!this.persistPath) {
      return;
    }
    try {
      const raw = readFileSync(this.persistPath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }
      for (const item of parsed) {
        const note = asNote(item);
        if (note) {
          this.notes.set(note.id, note);
        }
      }
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        return;
      }
      console.error(`Failed to load notes from ${this.persistPath}:`, err);
    }
  }

  private saveToDisk(): void {
    if (!this.persistPath) {
      return;
    }
    mkdirSync(dirname(this.persistPath), { recursive: true });
    writeFileSync(
      this.persistPath,
      JSON.stringify(this.list(), null, 2),
      "utf8",
    );
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

function asNote(value: unknown): Note | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.body !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    return undefined;
  }
  return {
    id: record.id,
    title: record.title,
    body: record.body,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === "object" && err !== null && "code" in err;
}
