import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App.tsx";
import type { Note } from "./api.ts";

const notes: Note[] = [];

beforeEach(() => {
  notes.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/notes") && method === "GET") {
        return jsonResponse(notes);
      }
      if (url.endsWith("/api/notes") && method === "POST") {
        const parsed = JSON.parse(String(init?.body)) as { title: string };
        const note: Note = {
          id: String(notes.length + 1),
          title: parsed.title,
          body: "",
          createdAt: new Date().toISOString(),
        };
        notes.unshift(note);
        return jsonResponse(note, 201);
      }
      return jsonResponse({}, 204);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
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
  });

  it("creates a note through the form", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/no notes yet/i);

    await user.type(screen.getByLabelText(/note title/i), "Buy milk");
    await user.click(screen.getByRole("button", { name: /add note/i }));

    await waitFor(() => {
      expect(screen.getByText("Buy milk")).toBeInTheDocument();
    });
  });
});
