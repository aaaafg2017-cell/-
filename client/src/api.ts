export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

const BASE = "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { cache: "no-store", ...init });
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw await toApiError(res);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (data?.error) message = data.error;
  } catch {
    // ignore non-JSON error bodies
  }
  return new ApiError(message, res.status);
}

const TITLE_MAX_LENGTH = 200;
const BODY_MAX_LENGTH = 8000;

export function parseNote(value: unknown): Note | undefined {
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
  const title = record.title.trim();
  const body = record.body.trim();
  if (
    title.length === 0 ||
    title.length > TITLE_MAX_LENGTH ||
    body.length > BODY_MAX_LENGTH
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
  return {
    id: record.id,
    title,
    body,
    createdAt,
    updatedAt,
  };
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

export function compareNotes(a: Note, b: Note): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

export function parseNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) {
    throw new ApiError("invalid notes response", 500);
  }
  const byId = new Map<string, Note>();
  for (const item of value) {
    const note = parseNote(item);
    if (note) {
      byId.set(note.id, note);
    }
  }
  if (value.length > 0 && byId.size === 0) {
    throw new ApiError("invalid notes response", 500);
  }
  return [...byId.values()].sort(compareNotes);
}

function requireNote(value: unknown): Note {
  const note = parseNote(value);
  if (!note) {
    throw new ApiError("invalid notes response", 500);
  }
  return note;
}

export async function fetchNotes(): Promise<Note[]> {
  return parseNotes(await handle<unknown>(await request(`${BASE}/notes`)));
}

export async function createNote(input: {
  title: string;
  body: string;
}): Promise<Note> {
  return requireNote(
    await handle<unknown>(
      await request(`${BASE}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    ),
  );
}

export async function updateNote(
  id: string,
  input: { title: string; body: string },
): Promise<Note> {
  return requireNote(
    await handle<unknown>(
      await request(`${BASE}/notes/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    ),
  );
}

export async function deleteNote(id: string): Promise<void> {
  await handle<void>(
    await request(`${BASE}/notes/${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}

export type ExportFormat = "json" | "markdown";

export interface NotesExport {
  blob: Blob;
  filename: string;
}

/** Filenames are quoted and ASCII-only, so a simple match is enough here. */
export function filenameFromDisposition(header: string | null): string | undefined {
  if (!header) {
    return undefined;
  }
  const match = header.match(/filename="([^"\\/]+)"/i) ?? header.match(/filename=([^;\s]+)/i);
  const filename = match?.[1]?.trim();
  return filename && !filename.includes("/") ? filename : undefined;
}

export function defaultExportFilename(format: ExportFormat, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `notes-${stamp}.${format === "markdown" ? "md" : "json"}`;
}

export async function exportNotes(format: ExportFormat): Promise<NotesExport> {
  const res = await request(`${BASE}/notes/export?format=${format}`);
  if (!res.ok) {
    throw await toApiError(res);
  }
  return {
    blob: await res.blob(),
    filename:
      filenameFromDisposition(res.headers.get("Content-Disposition")) ??
      defaultExportFilename(format),
  };
}
