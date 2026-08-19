import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/i);
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
});
