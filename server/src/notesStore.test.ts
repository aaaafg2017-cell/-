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
      expect(() => store.create({ title: "nope" })).toThrow(/refusing to overwrite/);
      expect(readFileSync(file, "utf8")).toBe(corrupt);
      expect(store.list()).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
