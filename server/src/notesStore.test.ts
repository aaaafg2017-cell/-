import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NotesStore } from "./notesStore.js";

describe("NotesStore persistence", () => {
  it("reloads notes from disk after a restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "notes.json");
    try {
      const first = new NotesStore(file);
      const created = first.create({ title: "persisted", body: "hello" });

      const second = new NotesStore(file);
      expect(second.list()).toEqual([created]);

      const raw = JSON.parse(readFileSync(file, "utf8")) as unknown[];
      expect(raw).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores a missing data file", () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "missing.json");
    try {
      const store = new NotesStore(file);
      expect(store.list()).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("backfills updatedAt from createdAt for older files", () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "notes.json");
    try {
      writeFileSync(
        file,
        JSON.stringify([
          {
            id: "legacy",
            title: "old format",
            body: "",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ]),
        "utf8",
      );
      const store = new NotesStore(file);
      expect(store.list()).toEqual([
        {
          id: "legacy",
          title: "old format",
          body: "",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not overwrite a corrupt data file", () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "notes.json");
    const corrupt = "{not json";
    try {
      writeFileSync(file, corrupt, "utf8");
      vi.spyOn(console, "error").mockImplementation(() => {});
      const store = new NotesStore(file);
      expect(store.persistStatus()).toBe("unavailable");
      expect(() => store.list()).toThrow(/could not be loaded/);
      expect(() => store.create({ title: "nope" })).toThrow(/refusing to overwrite/);
      expect(readFileSync(file, "utf8")).toBe(corrupt);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads valid notes but refuses writes when some records are invalid", () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "notes.json");
    try {
      writeFileSync(
        file,
        JSON.stringify([
          {
            id: "ok",
            title: "good",
            body: "",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
          { not: "a note" },
        ]),
        "utf8",
      );
      vi.spyOn(console, "error").mockImplementation(() => {});
      const store = new NotesStore(file);
      expect(store.persistStatus()).toBe("degraded");
      expect(store.list()).toEqual([
        {
          id: "ok",
          title: "good",
          body: "",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ]);
      expect(() => store.create({ title: "x" })).toThrow(/refusing to overwrite/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips empty titles, over-length fields, bad dates, and duplicate ids", () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "notes.json");
    try {
      writeFileSync(
        file,
        JSON.stringify([
          {
            id: "ok",
            title: "good",
            body: "",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
          {
            id: "ok",
            title: "duplicate should not replace",
            body: "",
            createdAt: "2024-02-01T00:00:00.000Z",
            updatedAt: "2024-02-01T00:00:00.000Z",
          },
          {
            id: "empty-title",
            title: "   ",
            body: "",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
          {
            id: "long-title",
            title: "x".repeat(201),
            body: "",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
          {
            id: "long-body",
            title: "ok",
            body: "y".repeat(8001),
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
          {
            id: "bad-date",
            title: "ok",
            body: "",
            createdAt: "not-a-date",
            updatedAt: "not-a-date",
          },
        ]),
        "utf8",
      );
      vi.spyOn(console, "error").mockImplementation(() => {});
      const store = new NotesStore(file);
      expect(store.persistStatus()).toBe("degraded");
      expect(store.list()).toEqual([
        {
          id: "ok",
          title: "good",
          body: "",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ]);
      expect(() => store.create({ title: "x" })).toThrow(/invalid records/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("canonicalizes mixed timestamp formats and sorts by instant", () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "notes.json");
    try {
      writeFileSync(
        file,
        JSON.stringify([
          {
            id: "newer",
            title: "with Z",
            body: "",
            createdAt: "2024-01-01T00:00:01Z",
            updatedAt: "2024-01-01T00:00:01Z",
          },
          {
            id: "older",
            title: "with ms",
            body: "",
            createdAt: "2024-01-01T00:00:00.500Z",
            updatedAt: "2024-01-01T00:00:00.500Z",
          },
        ]),
        "utf8",
      );
      const store = new NotesStore(file);
      expect(store.list().map((note) => note.id)).toEqual(["newer", "older"]);
      expect(store.list()[0]).toMatchObject({
        createdAt: "2024-01-01T00:00:01.000Z",
        updatedAt: "2024-01-01T00:00:01.000Z",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not treat equivalent timestamp strings as an edit", () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "notes.json");
    try {
      writeFileSync(
        file,
        JSON.stringify([
          {
            id: "same-instant",
            title: "legacy",
            body: "",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ]),
        "utf8",
      );
      const [note] = new NotesStore(file).list();
      expect(note.createdAt).toBe(note.updatedAt);
      expect(note.createdAt).toBe("2024-01-01T00:00:00.000Z");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("wraps disk write failures so callers can treat them as persist errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "notes.json");
    try {
      const store = new NotesStore(file);
      rmSync(dir, { recursive: true, force: true });
      writeFileSync(dir, "not a directory", "utf8");
      expect(() => store.create({ title: "nope" })).toThrow(/could not write notes data file/);
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        rmSync(dir, { force: true });
      }
    }
  });

  it("does not bump updatedAt when PUT applies the same title and body", () => {
    const store = new NotesStore();
    const created = store.create({ title: "same", body: "body" });
    const updated = store.update(created.id, { title: "same", body: " body " });
    expect(updated?.updatedAt).toBe(created.updatedAt);
    expect(updated?.title).toBe("same");
    expect(updated?.body).toBe("body");
  });
});
