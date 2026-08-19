import { describe, expect, it, vi } from "vitest";
import { ApiError, fetchNotes, parseNote, parseNotes } from "./api.ts";

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
    expect(parseNote({ ...valid, id: "   " })).toBeUndefined();
    expect(parseNote({ ...valid, title: 1 })).toBeUndefined();
    expect(parseNote({ ...valid, title: "   " })).toBeUndefined();
    expect(parseNote({ ...valid, title: "x".repeat(201) })).toBeUndefined();
    expect(parseNote({ ...valid, body: "y".repeat(8001) })).toBeUndefined();
    expect(parseNote({ ...valid, createdAt: "not-a-date" })).toBeUndefined();
  });

  it("trims ids and collapses title whitespace", () => {
    expect(
      parseNote({
        ...valid,
        id: "  1  ",
        title: "  Buy   milk  ",
      }),
    ).toEqual({
      ...valid,
      id: "1",
      title: "Buy milk",
    });
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

describe("fetchNotes", () => {
  it("wraps invalid JSON success bodies as ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("{", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    await expect(fetchNotes()).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      message: "invalid notes response",
    });
    vi.unstubAllGlobals();
  });
});
