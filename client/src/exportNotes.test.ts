import { describe, it, expect, vi, afterEach } from "vitest";
import {
  downloadTextFile,
  exportMimeType,
  formatNoteJson,
  formatNoteMarkdown,
  formatNotesJson,
  formatNotesMarkdown,
  noteExportFilename,
  notesExportFilename,
} from "./exportNotes.ts";
import type { Note } from "./api.ts";

const sample: Note[] = [
  {
    id: "a",
    title: "First",
    body: "Hello",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z",
  },
  {
    id: "b",
    title: "Second",
    body: "",
    createdAt: "2024-01-03T00:00:00.000Z",
    updatedAt: "2024-01-03T00:00:00.000Z",
  },
];

describe("formatNotesJson", () => {
  it("pretty-prints the notes array", () => {
    const parsed = JSON.parse(formatNotesJson(sample)) as Note[];
    expect(parsed).toEqual(sample);
    expect(formatNotesJson(sample).endsWith("\n")).toBe(true);
  });
});

describe("formatNotesMarkdown", () => {
  it("includes titles, bodies, and separators", () => {
    const md = formatNotesMarkdown(sample);
    expect(md).toContain("# First");
    expect(md).toContain("Hello");
    expect(md).toContain("# Second");
    expect(md).toContain("---");
    expect(md).toContain("id: a");
  });

  it("returns an empty string for no notes", () => {
    expect(formatNotesMarkdown([])).toBe("");
  });
});

describe("formatNoteMarkdown", () => {
  it("collapses whitespace in titles", () => {
    expect(formatNoteMarkdown({ ...sample[0], title: "  A\nB  " })).toContain(
      "# A B",
    );
  });
});

describe("filenames", () => {
  it("uses an ISO date stamp", () => {
    const now = new Date("2026-08-19T12:00:00.000Z");
    expect(notesExportFilename("json", now)).toBe("notes-2026-08-19.json");
    expect(notesExportFilename("markdown", now)).toBe("notes-2026-08-19.md");
  });

  it("sanitizes per-note filenames", () => {
    expect(
      noteExportFilename({ ...sample[0], title: 'a/b:"c"' }, "markdown"),
    ).toBe("a-b-c.md");
    expect(noteExportFilename({ ...sample[0], title: "   " }, "json")).toBe(
      "note.json",
    );
  });
});

describe("formatNoteJson", () => {
  it("pretty-prints a single note", () => {
    expect(JSON.parse(formatNoteJson(sample[0]))).toEqual(sample[0]);
  });
});

describe("exportMimeType", () => {
  it("returns charset-aware types", () => {
    expect(exportMimeType("json")).toContain("application/json");
    expect(exportMimeType("markdown")).toContain("text/markdown");
  });
});

describe("downloadTextFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("clicks a temporary download link", () => {
    const createObjectURL = vi.fn(() => "blob:notes");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadTextFile("notes.json", "{}", "application/json");

    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:notes");
  });
});
