export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

const BASE = "/api";

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
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function fetchNotes(): Promise<Note[]> {
  return handle<Note[]>(await request(`${BASE}/notes`));
}

export async function createNote(input: {
  title: string;
  body: string;
}): Promise<Note> {
  return handle<Note>(
    await request(`${BASE}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function updateNote(
  id: string,
  input: { title: string; body: string },
): Promise<Note> {
  return handle<Note>(
    await request(`${BASE}/notes/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteNote(id: string): Promise<void> {
  await handle<void>(
    await request(`${BASE}/notes/${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}
