import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
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
  private loadFailed = false;

  constructor(private persistPath?: string) {
    this.loadFromDisk();
  }

  persistStatus(): "ok" | "degraded" | "unavailable" {
    if (!this.loadFailed) {
      return "ok";
    }
    return this.notes.size === 0 ? "unavailable" : "degraded";
  }

  list(): Note[] {
    this.assertReadable();
    return [...this.notes.values()].sort(compareNotes);
  }

  get(id: string): Note | undefined {
    this.assertReadable();
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
    this.commitOrRollback(() => {
      this.notes.delete(note.id);
    });
    return note;
  }

  update(id: string, input: UpdateNoteInput): Note | undefined {
    this.assertReadable();
    const existing = this.notes.get(id);
    if (!existing) {
      return undefined;
    }
    const hasTitle = Object.hasOwn(input, "title") && input.title !== undefined;
    const hasBody = Object.hasOwn(input, "body") && input.body !== undefined;
    if (!hasTitle && !hasBody) {
      throw new ValidationError("title or body is required");
    }
    const nextTitle = hasTitle ? normalizeTitle(input.title) : existing.title;
    const nextBody = hasBody ? normalizeBody(input.body) : existing.body;
    if (nextTitle === existing.title && nextBody === existing.body) {
      return existing;
    }
    const updated: Note = {
      ...existing,
      title: nextTitle,
      body: nextBody,
      updatedAt: new Date().toISOString(),
    };
    this.notes.set(id, updated);
    this.commitOrRollback(() => {
      this.notes.set(id, existing);
    });
    return updated;
  }

  delete(id: string): boolean {
    this.assertReadable();
    const existing = this.notes.get(id);
    if (!existing) {
      return false;
    }
    this.notes.delete(id);
    this.commitOrRollback(() => {
      this.notes.set(id, existing);
    });
    return true;
  }

  clear(): void {
    const snapshot = [...this.notes.values()];
    this.notes.clear();
    this.commitOrRollback(() => {
      for (const note of snapshot) {
        this.notes.set(note.id, note);
      }
    });
  }

  private loadFromDisk(): void {
    if (!this.persistPath) {
      return;
    }
    try {
      const raw = readFileSync(this.persistPath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.loadFailed = true;
        console.error(`Notes data file is not an array: ${this.persistPath}`);
        return;
      }
      let skipped = 0;
      for (const item of parsed) {
        const note = asNote(item);
        if (!note) {
          skipped += 1;
          continue;
        }
        if (this.notes.has(note.id)) {
          skipped += 1;
          continue;
        }
        this.notes.set(note.id, note);
      }
      if (skipped > 0) {
        this.loadFailed = true;
        console.error(
          `Skipped ${skipped} invalid note(s) in ${this.persistPath}; refusing to overwrite`,
        );
      }
    } catch (err) {
      if (isNodeError(err) && err.code === "ENOENT") {
        return;
      }
      this.loadFailed = true;
      console.error(`Failed to load notes from ${this.persistPath}:`, err);
    }
  }

  private assertReadable(): void {
    if (this.persistStatus() === "unavailable") {
      throw new PersistError(
        "notes data file could not be loaded",
      );
    }
  }

  private commitOrRollback(rollback: () => void): void {
    try {
      this.saveToDisk();
    } catch (err) {
      rollback();
      throw err;
    }
  }

  private saveToDisk(): void {
    if (!this.persistPath) {
      return;
    }
    if (this.loadFailed) {
      throw new PersistError(
        this.notes.size === 0
          ? "notes data file could not be loaded; refusing to overwrite it"
          : "notes data file has invalid records; refusing to overwrite it",
      );
    }
    try {
      mkdirSync(dirname(this.persistPath), { recursive: true });
      const tmpPath = `${this.persistPath}.${process.pid}.tmp`;
      try {
        writeFileSync(
          tmpPath,
          JSON.stringify([...this.notes.values()].sort(compareNotes), null, 2),
          "utf8",
        );
        renameSync(tmpPath, this.persistPath);
      } catch (err) {
        try {
          unlinkSync(tmpPath);
        } catch {
          // ignore cleanup failures
        }
        throw err;
      }
    } catch (err) {
      if (err instanceof PersistError) {
        throw err;
      }
      const detail = err instanceof Error ? err.message : "unknown error";
      throw new PersistError(`could not write notes data file: ${detail}`);
    }
  }
}

export class ValidationError extends Error {}
export class PersistError extends Error {}

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
    record.id.trim().length === 0 ||
    typeof record.title !== "string" ||
    typeof record.body !== "string" ||
    typeof record.createdAt !== "string"
  ) {
    return undefined;
  }
  const createdAt = canonicalIso(record.createdAt);
  if (!createdAt) {
    return undefined;
  }
  const updatedAt = canonicalIso(
    typeof record.updatedAt === "string" ? record.updatedAt : record.createdAt,
  );
  if (!updatedAt) {
    return undefined;
  }
  try {
    return {
      id: record.id,
      title: normalizeTitle(record.title),
      body: normalizeBody(record.body),
      createdAt,
      updatedAt,
    };
  } catch {
    return undefined;
  }
}

function canonicalIso(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return undefined;
  }
  return new Date(ms).toISOString();
}

function compareNotes(a: Note, b: Note): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return typeof err === "object" && err !== null && "code" in err;
}
