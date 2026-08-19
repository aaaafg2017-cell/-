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
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError("invalid notes response", 500);
  }
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
    typeof record.title !== "string" ||
    typeof record.body !== "string" ||
    typeof record.createdAt !== "string"
  ) {
    return undefined;
  }
  const id = record.id.trim();
  const title = record.title.replace(/\s+/g, " ").trim();
  const body = record.body.trim();
  if (
    id.length === 0 ||
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
    id,
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
  const delta = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  if (delta !== 0 && Number.isFinite(delta)) {
    return delta;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
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
