import { describe, it, expect } from "vitest";
import {
  formatNotesJson,
  formatNotesMarkdown,
  notesExportFilename,
  parseExportFormat,
} from "./exportNotes.js";
import type { Note } from "./notesStore.js";

const notes: Note[] = [
  {
    id: "n1",
    title: "Alpha",
    body: "one",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
];

describe("parseExportFormat", () => {
  it("defaults to json", () => {
    expect(parseExportFormat(undefined)).toBe("json");
    expect(parseExportFormat("")).toBe("json");
  });

  it("accepts json, markdown, and md", () => {
    expect(parseExportFormat("json")).toBe("json");
    expect(parseExportFormat("markdown")).toBe("markdown");
    expect(parseExportFormat("md")).toBe("markdown");
  });

  it("rejects unknown values", () => {
    expect(parseExportFormat("csv")).toBeUndefined();
    expect(parseExportFormat(["json"])).toBeUndefined();
  });
});

describe("export formatters", () => {
  it("emits JSON and Markdown", () => {
    expect(JSON.parse(formatNotesJson(notes))).toEqual(notes);
    expect(formatNotesMarkdown(notes)).toContain("# Alpha");
    expect(formatNotesMarkdown(notes)).toContain("one");
  });

  it("names files with a UTC date", () => {
    const now = new Date("2026-08-19T07:00:00.000Z");
    expect(notesExportFilename("json", now)).toBe("notes-2026-08-19.json");
    expect(notesExportFilename("markdown", now)).toBe("notes-2026-08-19.md");
  });
});
