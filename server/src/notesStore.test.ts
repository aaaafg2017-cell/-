import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
});
