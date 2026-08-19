import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "./api.ts";
import {
  EXPORT_MIME_TYPE,
  buildNotesExport,
  downloadNotes,
  downloadTextFile,
  exportFilename,
  serializeNotes,
} from "./export.ts";

/** jsdom's Blob has no `text()`, so read it the long way. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function note(overrides: Partial<Note> & Pick<Note, "id">): Note {
  return {
    title: `Title ${overrides.id}`,
    body: `Body ${overrides.id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildNotesExport", () => {
  it("wraps notes with version, timestamp, and count", () => {
    const payload = buildNotesExport(
      [note({ id: "a" })],
      new Date("2026-08-19T07:46:00.000Z"),
    );
    expect(payload).toEqual({
      version: 1,
      exportedAt: "2026-08-19T07:46:00.000Z",
      count: 1,
      notes: [note({ id: "a" })],
    });
  });

  it("orders notes newest first without mutating the input", () => {
    const input = [
      note({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
      note({ id: "new", updatedAt: "2026-06-01T00:00:00.000Z" }),
    ];
    expect(buildNotesExport(input).notes.map((item) => item.id)).toEqual([
      "new",
      "old",
    ]);
    expect(input.map((item) => item.id)).toEqual(["old", "new"]);
  });

  it("keeps only note fields", () => {
    const extra = { ...note({ id: "a" }), secret: "nope" } as Note;
    expect(buildNotesExport([extra]).notes[0]).not.toHaveProperty("secret");
  });
});

describe("serializeNotes", () => {
  it("writes indented JSON that ends with a newline", () => {
    const text = serializeNotes([note({ id: "a" })]);
    expect(text.endsWith("\n")).toBe(true);
    expect(text).toContain('\n  "version": 1');
    expect(JSON.parse(text).notes).toHaveLength(1);
  });

  it("keeps Arabic text readable instead of escaping it", () => {
    const text = serializeNotes([note({ id: "a", title: "ملاحظة", body: "مرحبا" })]);
    expect(text).toContain("ملاحظة");
    expect(JSON.parse(text).notes[0].body).toBe("مرحبا");
  });

  it("exports an empty list as an empty array", () => {
    expect(JSON.parse(serializeNotes([]))).toMatchObject({ count: 0, notes: [] });
  });
});

describe("exportFilename", () => {
  it("uses a zero padded local calendar date", () => {
    expect(exportFilename(new Date(2026, 7, 9, 13, 30))).toBe("notes-2026-08-09.json");
    expect(exportFilename(new Date(2026, 11, 31, 23, 59))).toBe("notes-2026-12-31.json");
  });
});

describe("downloadTextFile", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clicks: { download: string; href: string }[];

  beforeEach(() => {
    clicks = [];
    createObjectURL = vi.fn(() => "blob:notes");
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        clicks.push({ download: this.download, href: this.href });
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  it("clicks a temporary anchor and cleans it up", async () => {
    downloadTextFile("notes.json", '{"a":1}', EXPORT_MIME_TYPE);

    expect(clicks).toEqual([{ download: "notes.json", href: "blob:notes" }]);
    expect(document.querySelectorAll("a")).toHaveLength(0);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe(EXPORT_MIME_TYPE);
    expect(await readBlob(blob)).toBe('{"a":1}');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:notes");
  });

  it("removes the anchor even when the click throws", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => downloadTextFile("notes.json", "{}", EXPORT_MIME_TYPE)).toThrow(
      "blocked",
    );
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });

  it("throws when the browser cannot create object URLs", () => {
    Reflect.deleteProperty(URL, "createObjectURL");
    expect(() => downloadTextFile("notes.json", "{}", EXPORT_MIME_TYPE)).toThrow(
      /not supported/i,
    );
  });

  it("downloadNotes names the file by date and serializes the notes", async () => {
    downloadNotes([note({ id: "a" })], new Date(2026, 7, 19, 9, 0));

    expect(clicks[0].download).toBe("notes-2026-08-19.json");
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(JSON.parse(await readBlob(blob)).notes[0].id).toBe("a");
  });
});
