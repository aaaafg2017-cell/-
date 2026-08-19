import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.tsx";
import type { Note } from "./api.ts";

const notes: Note[] = [];

beforeEach(() => {
  notes.length = 0;
  Object.defineProperty(navigator, "language", {
    configurable: true,
    get: () => "en-US",
  });
  Object.defineProperty(navigator, "languages", {
    configurable: true,
    get: () => ["en-US"],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      const parsed = init?.body
        ? (JSON.parse(String(init.body)) as { title: string; body?: string })
        : undefined;

      if (url.endsWith("/api/notes") && method === "GET") {
        return jsonResponse(notes);
      }
      if (url.endsWith("/api/notes") && method === "POST") {
        const now = new Date().toISOString();
        const note: Note = {
          id: String(notes.length + 1),
          title: parsed?.title ?? "",
          body: parsed?.body ?? "",
          createdAt: now,
          updatedAt: now,
        };
        notes.unshift(note);
        return jsonResponse(note, 201);
      }
      const idMatch = url.match(/\/api\/notes\/([^/]+)$/);
      const id = idMatch?.[1];
      if (id && method === "PUT") {
        const index = notes.findIndex((note) => note.id === id);
        if (index === -1) {
          return jsonResponse({ error: "note not found" }, 404);
        }
        notes[index] = {
          ...notes[index],
          title: parsed?.title ?? notes[index].title,
          body: parsed?.body ?? notes[index].body,
          updatedAt: new Date().toISOString(),
        };
        return jsonResponse(notes[index]);
      }
      if (id && method === "DELETE") {
        const index = notes.findIndex((note) => note.id === id);
        if (index === -1) {
          return jsonResponse({ error: "note not found" }, 404);
        }
        notes.splice(index, 1);
        return jsonResponse(null, 204);
      }
      return jsonResponse({ error: "not found" }, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("App", () => {
  it("shows the empty state initially", async () => {
    render(<App />);
    expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/notes",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("keeps a created note visible if the list refresh fails", async () => {
    const user = userEvent.setup();
    let getCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        const parsed = init?.body
          ? (JSON.parse(String(init.body)) as { title: string; body?: string })
          : undefined;

        if (url.endsWith("/api/notes") && method === "GET") {
          getCount += 1;
          if (getCount > 1) {
            return jsonResponse(
              { error: "notes data file could not be loaded" },
              503,
            );
          }
          return jsonResponse(notes);
        }
        if (url.endsWith("/api/notes") && method === "POST") {
          const now = new Date().toISOString();
          const note: Note = {
            id: "created-1",
            title: parsed?.title ?? "",
            body: parsed?.body ?? "",
            createdAt: now,
            updatedAt: now,
          };
          notes.unshift(note);
          return jsonResponse(note, 201);
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    render(<App />);
    await screen.findByText(/no notes yet/i);

    await user.type(screen.getByLabelText(/note title/i), "Kept note");
    await user.click(screen.getByRole("button", { name: /add note/i }));

    await waitFor(() => {
      expect(screen.getByText("Kept note")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/could not load notes from disk/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("creates a note through the form including the body", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/no notes yet/i);

    await user.type(screen.getByLabelText(/note title/i), "Buy milk");
    await user.type(screen.getByLabelText(/note body/i), "2 liters");
    await user.click(screen.getByRole("button", { name: /add note/i }));

    await waitFor(() => {
      expect(screen.getByText("Buy milk")).toBeInTheDocument();
    });
    expect(screen.getByText("2 liters")).toBeInTheDocument();
  });

  it("requires a title before creating a note", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/no notes yet/i);

    await user.click(screen.getByRole("button", { name: /add note/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/title/i);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("edits an existing note", async () => {
    const user = userEvent.setup();
    notes.push({
      id: "1",
      title: "Old title",
      body: "Old body",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    render(<App />);
    expect(await screen.findByText("Old title")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    const titleInput = screen.getByLabelText(/note title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "New title");
    await user.click(screen.getByRole("button", { name: /save note/i }));

    await waitFor(() => {
      expect(screen.getByText("New title")).toBeInTheDocument();
    });
    expect(screen.queryByText("Old title")).not.toBeInTheDocument();
  });

  it("deletes a note after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    notes.push({
      id: "1",
      title: "Throw away",
      body: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    render(<App />);
    expect(await screen.findByText("Throw away")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete throw away/i }));
    await waitFor(() => {
      expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });
  });

  it("does not delete when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    notes.push({
      id: "1",
      title: "Keep me",
      body: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    render(<App />);
    expect(await screen.findByText("Keep me")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete keep me/i }));
    expect(screen.getByText("Keep me")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("filters notes by search query", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    notes.push(
      { id: "1", title: "Buy milk", body: "2 liters", createdAt: now, updatedAt: now },
      { id: "2", title: "Walk dog", body: "evening", createdAt: now, updatedAt: now },
    );
    render(<App />);
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/search notes/i), "dog");
    expect(screen.getByText("Walk dog")).toBeInTheDocument();
    expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();
  });

  it("clears search after creating a note so it stays visible", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Walk dog",
      body: "evening",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("Walk dog")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/search notes/i), "dog");
    expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/note title/i), "Buy milk");
    await user.click(screen.getByRole("button", { name: /add note/i }));

    await waitFor(() => {
      expect(screen.getByText("Buy milk")).toBeInTheDocument();
    });
    expect(screen.getByText("Walk dog")).toBeInTheDocument();
    expect(screen.getByLabelText(/search notes/i)).toHaveValue("");
  });

  it("retries loading notes after a failure", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempts += 1;
        if (attempts === 1) {
          return jsonResponse({ error: "offline" }, 500);
        }
        return jsonResponse(notes);
      }),
    );

    render(<App />);
    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument();
  });

  it("renders Arabic copy when the browser language is Arabic", async () => {
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "ar-SA",
    });
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["ar-SA", "en"],
    });
    render(<App />);
    expect(await screen.findByRole("heading", { name: "الملاحظات" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إضافة ملاحظة" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });

  it("marks the title field invalid when submitting without a title", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/no notes yet/i);

    await user.click(screen.getByRole("button", { name: /add note/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/title/i);
    expect(screen.getByLabelText(/note title/i)).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the title-required error while the user types", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/no notes yet/i);

    await user.click(screen.getByRole("button", { name: /add note/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/title/i);

    await user.type(screen.getByLabelText(/note title/i), "A");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the note being edited visible when search does not match it", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    notes.push(
      { id: "1", title: "Buy milk", body: "2 liters", createdAt: now, updatedAt: now },
      { id: "2", title: "Walk dog", body: "evening", createdAt: now, updatedAt: now },
    );
    render(<App />);
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /edit/i })[0]);
    await user.type(screen.getByLabelText(/search notes/i), "dog");

    expect(screen.getByText("Walk dog")).toBeInTheDocument();
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByLabelText(/note title/i)).toHaveValue("Buy milk");
  });

  it("cancels edit when Escape is pressed", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Draft",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("Draft")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("button", { name: /save note/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/note title/i)).toHaveValue("");
  });

  it("cancels edit when Escape is pressed from the search field", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Draft",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("Draft")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("button", { name: /save note/i })).toBeInTheDocument();

    await user.click(screen.getByLabelText(/search notes/i));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/note title/i)).toHaveValue("");
  });

  it("retries when the API is unreachable on first load", async () => {
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new TypeError("Failed to fetch");
        }
        return jsonResponse(notes);
      }),
    );

    render(<App />);
    expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("shows a localized network error after retries are exhausted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not reach the notes api/i,
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("asks before discarding unsaved edits when cancelling with Escape", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Draft",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("Draft")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.type(screen.getByLabelText(/note title/i), " changed");
    await user.keyboard("{Escape}");

    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /save note/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/note title/i)).toHaveValue("Draft changed");
  });

  it("asks before discarding unsaved edits when clicking Cancel", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Draft",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("Draft")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.type(screen.getByLabelText(/note body/i), "new body");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /save note/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/note body/i)).toHaveValue("new body");
  });

  it("does not prompt again on Escape after unsaved edits were discarded", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Draft",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("Draft")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.type(screen.getByLabelText(/note title/i), " changed");
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();

    confirm.mockClear();
    await user.keyboard("{Escape}");
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
  });

  it("retries when the Vite proxy returns 502 on first load", async () => {
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempts += 1;
        if (attempts === 1) {
          return jsonResponse({ error: "api unreachable" }, 502);
        }
        return jsonResponse(notes);
      }),
    );

    render(<App />);
    expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("shows a localized network error after proxy 502 retries are exhausted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "api unreachable" }, 502)),
    );

    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not reach the notes api/i,
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("asks before discarding unsaved edits when switching notes", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const now = new Date().toISOString();
    notes.push(
      { id: "1", title: "First", body: "one", createdAt: now, updatedAt: now },
      { id: "2", title: "Second", body: "two", createdAt: now, updatedAt: now },
    );
    render(<App />);
    expect(await screen.findByText("First")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /edit/i })[0]);
    const titleInput = screen.getByLabelText(/note title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Changed");
    await user.click(screen.getAllByRole("button", { name: /edit/i })[1]);

    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /save note/i })).toBeInTheDocument();
    expect(titleInput).toHaveValue("Changed");
  });

  it("does not create two notes when the form is submitted twice", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let posts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/notes") && method === "GET") {
          return jsonResponse(notes);
        }
        if (url.endsWith("/api/notes") && method === "POST") {
          posts += 1;
          await gate;
          const parsed = init?.body
            ? (JSON.parse(String(init.body)) as { title: string; body?: string })
            : undefined;
          const now = new Date().toISOString();
          const note: Note = {
            id: String(posts),
            title: parsed?.title ?? "",
            body: parsed?.body ?? "",
            createdAt: now,
            updatedAt: now,
          };
          notes.unshift(note);
          return jsonResponse(note, 201);
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    render(<App />);
    await screen.findByText(/no notes yet/i);
    await user.type(screen.getByLabelText(/note title/i), "Once");
    const form = screen.getByLabelText(/note title/i).closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    fireEvent.submit(form!);
    release();

    await waitFor(() => {
      expect(screen.getByText("Once")).toBeInTheDocument();
    });
    expect(posts).toBe(1);
  });

  it("disables submit while the first load is in progress", async () => {
    let resolveGet!: (value: Response) => void;
    const firstGet = new Promise<Response>((resolve) => {
      resolveGet = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/notes") && method === "GET") {
          return firstGet;
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    render(<App />);
    expect(screen.getByRole("button", { name: /add note/i })).toBeDisabled();
    resolveGet(jsonResponse(notes));
    expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add note/i })).toBeEnabled();
  });

  it("does not prompt to discard after a successful save", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm");
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Draft",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("Draft")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.type(screen.getByLabelText(/note title/i), " saved");
    await user.click(screen.getByRole("button", { name: /save note/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
    });

    confirm.mockClear();
    await user.keyboard("{Escape}");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("does not prompt to discard while a save is in flight", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Draft",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/notes") && method === "GET") {
          return jsonResponse(notes);
        }
        const idMatch = url.match(/\/api\/notes\/([^/]+)$/);
        if (idMatch && method === "PUT") {
          await gate;
          const parsed = init?.body
            ? (JSON.parse(String(init.body)) as { title: string; body?: string })
            : undefined;
          notes[0] = {
            ...notes[0],
            title: parsed?.title ?? notes[0].title,
            body: parsed?.body ?? notes[0].body,
            updatedAt: new Date().toISOString(),
          };
          return jsonResponse(notes[0]);
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    render(<App />);
    expect(await screen.findByText("Draft")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.type(screen.getByLabelText(/note title/i), " saved");
    fireEvent.submit(screen.getByLabelText(/note title/i).closest("form")!);

    confirm.mockClear();
    await user.keyboard("{Escape}");
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/note title/i)).toHaveValue("Draft saved");

    release();
    await waitFor(() => {
      expect(screen.getByText("Draft saved")).toBeInTheDocument();
    });
  });

  it("retries a transient 502 after a successful create", async () => {
    const user = userEvent.setup();
    let gets = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        const parsed = init?.body
          ? (JSON.parse(String(init.body)) as { title: string; body?: string })
          : undefined;
        if (url.endsWith("/api/notes") && method === "GET") {
          gets += 1;
          if (gets === 2) {
            return jsonResponse({ error: "api unreachable" }, 502);
          }
          return jsonResponse(notes);
        }
        if (url.endsWith("/api/notes") && method === "POST") {
          const now = new Date().toISOString();
          const note: Note = {
            id: "created-1",
            title: parsed?.title ?? "",
            body: parsed?.body ?? "",
            createdAt: now,
            updatedAt: now,
          };
          notes.unshift(note);
          return jsonResponse(note, 201);
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    render(<App />);
    await screen.findByText(/no notes yet/i);
    await user.type(screen.getByLabelText(/note title/i), "Kept after 502");
    await user.click(screen.getByRole("button", { name: /add note/i }));

    await waitFor(() => {
      expect(screen.getByText("Kept after 502")).toBeInTheDocument();
      expect(gets).toBeGreaterThanOrEqual(3);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not crash when the notes API returns a non-array payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ notes: [] })),
    );

    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid notes response/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("matches Arabic notes that differ only by alef form", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "أحمد",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("أحمد")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/search notes/i), "احمد");
    expect(screen.getByText("أحمد")).toBeInTheDocument();
    expect(screen.queryByText(/no notes match/i)).not.toBeInTheDocument();
  });

  it("disables save until the edited note actually changes", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Same",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("Same")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("button", { name: /save note/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/note title/i), "!");
    expect(screen.getByRole("button", { name: /save note/i })).toBeEnabled();
  });

  it("keeps valid notes when the list payload includes invalid items", async () => {
    const now = new Date().toISOString();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse([
          {
            id: "1",
            title: "Kept",
            body: "",
            createdAt: now,
            updatedAt: now,
          },
          null,
          { not: "a note" },
        ]),
      ),
    );

    render(<App />);
    expect(await screen.findByText("Kept")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a localized persist error after a 503", async () => {
    Object.defineProperty(navigator, "language", {
      configurable: true,
      get: () => "ar",
    });
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      get: () => ["ar"],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: "notes data file could not be loaded" }, 503),
      ),
    );

    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /تعذر تحميل الملاحظات من القرص/,
    );
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeInTheDocument();
  });

  it("keeps the load error when starting an edit", async () => {
    const user = userEvent.setup();
    let getCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        const parsed = init?.body
          ? (JSON.parse(String(init.body)) as { title: string; body?: string })
          : undefined;

        if (url.endsWith("/api/notes") && method === "GET") {
          getCount += 1;
          if (getCount > 1) {
            return jsonResponse(
              { error: "notes data file could not be loaded" },
              503,
            );
          }
          return jsonResponse(notes);
        }
        if (url.endsWith("/api/notes") && method === "POST") {
          const now = new Date().toISOString();
          const note: Note = {
            id: "created-1",
            title: parsed?.title ?? "",
            body: parsed?.body ?? "",
            createdAt: now,
            updatedAt: now,
          };
          notes.unshift(note);
          return jsonResponse(note, 201);
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    render(<App />);
    await screen.findByText(/no notes yet/i);
    await user.type(screen.getByLabelText(/note title/i), "Kept note");
    await user.click(screen.getByRole("button", { name: /add note/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not load notes from disk/i,
    );

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /could not load notes from disk/i,
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("asks before discarding a new unsaved draft with Escape", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App />);
    await screen.findByText(/no notes yet/i);

    await user.type(screen.getByLabelText(/note title/i), "Draft title");
    await user.keyboard("{Escape}");

    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText(/note title/i)).toHaveValue("Draft title");
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("turns a missing edited note into a new draft", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Draft",
      body: "body",
      createdAt: now,
      updatedAt: now,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/notes") && method === "GET") {
          return jsonResponse(notes);
        }
        if (method === "PUT") {
          return jsonResponse({ error: "note not found" }, 404);
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    render(<App />);
    expect(await screen.findByText("Draft")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.type(screen.getByLabelText(/note title/i), " kept");
    await user.click(screen.getByRole("button", { name: /save note/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /save again to keep it as a new note/i,
    );
    expect(screen.getByRole("button", { name: /add note/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/note title/i)).toHaveValue("Draft kept");
    expect(screen.queryByRole("heading", { name: "Draft" })).not.toBeInTheDocument();
  });

  it("removes a note from the list when delete returns 404", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Already gone",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/notes") && method === "GET") {
          return jsonResponse(notes);
        }
        if (method === "DELETE") {
          return jsonResponse({ error: "note not found" }, 404);
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    render(<App />);
    expect(await screen.findByText("Already gone")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /delete already gone/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no longer exists/i);
    expect(screen.queryByText("Already gone")).not.toBeInTheDocument();
    expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument();
  });

  it("labels edit buttons with the note title", async () => {
    const now = new Date().toISOString();
    notes.push(
      { id: "1", title: "Buy milk", body: "", createdAt: now, updatedAt: now },
      { id: "2", title: "Walk dog", body: "", createdAt: now, updatedAt: now },
    );
    render(<App />);
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit buy milk/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit walk dog/i })).toBeInTheDocument();
  });

  it("moves keyboard focus to the title field when editing a note", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Draft",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("Draft")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/note title/i)).toHaveFocus();
    });
    expect(screen.getByLabelText(/note title/i)).toHaveValue("Draft");
  });

  it("does not mark a note as edited when timestamps are the same instant", async () => {
    notes.push({
      id: "1",
      title: "Legacy",
      body: "",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    render(<App />);
    expect(await screen.findByText("Legacy")).toBeInTheDocument();
    expect(screen.queryByText(/edited/i)).not.toBeInTheDocument();
  });

  it("matches Arabic notes that differ by hamza on waw", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "سؤال",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("سؤال")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/search notes/i), "سوال");
    expect(screen.getByText("سؤال")).toBeInTheDocument();
    expect(screen.queryByText(/no notes match/i)).not.toBeInTheDocument();
  });

  it("matches notes when the search query has extra spaces", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    notes.push({
      id: "1",
      title: "Buy milk",
      body: "",
      createdAt: now,
      updatedAt: now,
    });
    render(<App />);
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/search notes/i), "Buy  milk");
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.queryByText(/no notes match/i)).not.toBeInTheDocument();
  });

  it("localizes validation errors from the API", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "ar-SA",
    });
    Object.defineProperty(navigator, "languages", {
      configurable: true,
      value: ["ar-SA"],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.endsWith("/api/notes") && method === "GET") {
          return jsonResponse([]);
        }
        if (method === "POST") {
          return jsonResponse({ error: "title must be at most 200 characters" }, 400);
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    render(<App />);
    await screen.findByText(/لا توجد ملاحظات بعد/);
    await user.type(screen.getByLabelText("عنوان الملاحظة"), "عنوان");
    await user.click(screen.getByRole("button", { name: "إضافة ملاحظة" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "يجب ألا يتجاوز العنوان 200 حرف.",
    );
  });
});
