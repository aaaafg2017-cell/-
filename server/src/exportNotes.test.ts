import { describe, it, expect } from "vitest";
import {
  exportFilename,
  notesToJson,
  notesToMarkdown,
  parseExportFormat,
  renderNotesExport,
} from "./exportNotes.js";

const notes = [
  {
    id: "a1",
    title: "Buy milk",
    body: "2 liters",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-02T11:00:00.000Z",
  },
  {
    id: "b2",
    title: "Walk dog",
    body: "",
    createdAt: "2026-08-03T09:00:00.000Z",
    updatedAt: "2026-08-03T09:00:00.000Z",
  },
];

describe("parseExportFormat", () => {
  it("defaults missing values to json", () => {
    expect(parseExportFormat(undefined)).toBe("json");
    expect(parseExportFormat("")).toBe("json");
  });

  it("accepts json and markdown aliases", () => {
    expect(parseExportFormat("JSON")).toBe("json");
    expect(parseExportFormat("md")).toBe("md");
    expect(parseExportFormat("Markdown")).toBe("md");
  });

  it("rejects unknown formats", () => {
    expect(parseExportFormat("csv")).toBeUndefined();
    expect(parseExportFormat("pdf")).toBeUndefined();
  });
});

describe("notes export rendering", () => {
  it("builds a dated filename", () => {
    expect(exportFilename("json", "2026-08-19T07:46:00.000Z")).toBe(
      "notes-2026-08-19.json",
    );
    expect(exportFilename("md", "2026-08-19T07:46:00.000Z")).toBe(
      "notes-2026-08-19.md",
    );
  });

  it("serializes JSON with count and timestamps", () => {
    const json = notesToJson(notes, "2026-08-19T08:00:00.000Z");
    expect(JSON.parse(json)).toEqual({
      exportedAt: "2026-08-19T08:00:00.000Z",
      count: 2,
      notes,
    });
  });

  it("renders markdown with titles, bodies, and ids", () => {
    const md = notesToMarkdown(notes, "2026-08-19T08:00:00.000Z");
    expect(md).toContain("# Notes");
    expect(md).toContain("Count: 2");
    expect(md).toContain("## Buy milk");
    expect(md).toContain("2 liters");
    expect(md).toContain("## Walk dog");
    expect(md).toContain("`a1`");
    expect(md).toContain("`b2`");
  });

  it("renders an empty markdown document", () => {
    const md = notesToMarkdown([], "2026-08-19T08:00:00.000Z");
    expect(md).toContain("Count: 0");
    expect(md).toContain("_No notes._");
  });

  it("picks the matching content type", () => {
    const json = renderNotesExport(notes, "json", "2026-08-19T08:00:00.000Z");
    expect(json.contentType).toMatch(/application\/json/);
    expect(json.filename).toBe("notes-2026-08-19.json");
    const md = renderNotesExport(notes, "md", "2026-08-19T08:00:00.000Z");
    expect(md.contentType).toMatch(/text\/markdown/);
    expect(md.filename).toBe("notes-2026-08-19.md");
  });
});
