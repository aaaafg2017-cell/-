import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  defaultExportFilename,
  exportNotes,
  filenameFromDisposition,
  parseNote,
  parseNotes,
} from "./api.ts";

const valid = {
  id: "1",
  title: "Buy milk",
  body: "2 liters",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
};

describe("parseNote", () => {
  it("accepts a complete note", () => {
    expect(parseNote(valid)).toEqual(valid);
  });

  it("backfills updatedAt from createdAt", () => {
    const legacy = {
      id: "1",
      title: "Buy milk",
      body: "2 liters",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    expect(parseNote(legacy)).toEqual({
      ...legacy,
      updatedAt: legacy.createdAt,
    });
  });

  it("canonicalizes mixed timestamp formats", () => {
    expect(
      parseNote({
        ...valid,
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      ...valid,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("rejects missing fields, empty ids, empty titles, and over-length text", () => {
    expect(parseNote(null)).toBeUndefined();
    expect(parseNote({ ...valid, id: "" })).toBeUndefined();
    expect(parseNote({ ...valid, title: 1 })).toBeUndefined();
    expect(parseNote({ ...valid, title: "   " })).toBeUndefined();
    expect(parseNote({ ...valid, title: "x".repeat(201) })).toBeUndefined();
    expect(parseNote({ ...valid, body: "y".repeat(8001) })).toBeUndefined();
    expect(parseNote({ ...valid, createdAt: "not-a-date" })).toBeUndefined();
  });
});

describe("parseNotes", () => {
  it("rejects a non-array payload", () => {
    expect(() => parseNotes({ notes: [] })).toThrow(ApiError);
  });

  it("keeps valid notes and drops invalid items", () => {
    expect(parseNotes([valid, null, { not: "a note" }])).toEqual([valid]);
  });

  it("dedupes by id, keeping the later copy", () => {
    const later = { ...valid, title: "Buy oat milk" };
    expect(parseNotes([valid, later])).toEqual([later]);
  });

  it("throws when every item is invalid", () => {
    expect(() => parseNotes([{ not: "a note" }])).toThrow(/invalid notes response/);
  });

  it("sorts notes by instant rather than timestamp string", () => {
    const older = {
      ...valid,
      id: "older",
      title: "older",
      createdAt: "2024-01-01T00:00:00.500Z",
      updatedAt: "2024-01-01T00:00:00.500Z",
    };
    const newer = {
      ...valid,
      id: "newer",
      title: "newer",
      createdAt: "2024-01-01T00:00:01Z",
      updatedAt: "2024-01-01T00:00:01Z",
    };
    expect(parseNotes([older, newer]).map((note) => note.id)).toEqual([
      "newer",
      "older",
    ]);
  });
});

describe("filenameFromDisposition", () => {
  it("reads a quoted filename", () => {
    expect(filenameFromDisposition('attachment; filename="notes-2024-01-01.json"')).toBe(
      "notes-2024-01-01.json",
    );
  });

  it("reads an unquoted filename", () => {
    expect(filenameFromDisposition("attachment; filename=notes.md")).toBe("notes.md");
  });

  it("ignores a missing header or a path-like filename", () => {
    expect(filenameFromDisposition(null)).toBeUndefined();
    expect(filenameFromDisposition("attachment")).toBeUndefined();
    expect(filenameFromDisposition('attachment; filename="../../etc/passwd"')).toBeUndefined();
  });
});

describe("defaultExportFilename", () => {
  it("names files by format and date", () => {
    const day = new Date("2024-03-05T10:00:00.000Z");
    expect(defaultExportFilename("json", day)).toBe("notes-2024-03-05.json");
    expect(defaultExportFilename("markdown", day)).toBe("notes-2024-03-05.md");
  });
});

describe("exportNotes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the chosen format and uses the server filename", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("# Notes", {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": 'attachment; filename="notes-2024-01-01.md"',
          },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const file = await exportNotes("markdown");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notes/export?format=markdown",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(file.filename).toBe("notes-2024-01-01.md");
    expect(await file.blob.text()).toBe("# Notes");
  });

  it("falls back to a generated filename", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { status: 200 })),
    );
    const file = await exportNotes("json");
    expect(file.filename).toMatch(/^notes-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it("throws an ApiError when the export fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "notes data file could not be loaded" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    await expect(exportNotes("json")).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      message: "notes data file could not be loaded",
    });
  });
});
