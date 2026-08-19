import { describe, it, expect, vi, afterEach } from "vitest";
import {
  downloadText,
  exportFilename,
  notesToJson,
  notesToMarkdown,
  renderNotesExport,
} from "./exportNotes.ts";
import type { Note } from "./api.ts";

const notes: Note[] = [
  {
    id: "a1",
    title: "شراء حليب",
    body: "لتران",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-02T11:00:00.000Z",
  },
];

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("client notes export", () => {
  it("names the download with the export date", () => {
    expect(exportFilename("json", "2026-08-19T07:46:00.000Z")).toBe(
      "notes-2026-08-19.json",
    );
  });

  it("keeps Arabic text in JSON and Markdown", () => {
    const exportedAt = "2026-08-19T08:00:00.000Z";
    expect(JSON.parse(notesToJson(notes, exportedAt)).notes[0].title).toBe(
      "شراء حليب",
    );
    expect(notesToMarkdown(notes, exportedAt)).toContain("## شراء حليب");
    expect(notesToMarkdown(notes, exportedAt)).toContain("لتران");
  });

  it("escapes markdown ATX prefixes in titles", () => {
    const md = notesToMarkdown(
      [
        {
          id: "h1",
          title: "# not a heading",
          body: "",
          createdAt: "2026-08-01T10:00:00.000Z",
          updatedAt: "2026-08-01T10:00:00.000Z",
        },
      ],
      "2026-08-19T08:00:00.000Z",
    );
    expect(md).toContain("## \\# not a heading");
  });

  it("renders json and markdown payloads", () => {
    const json = renderNotesExport(notes, "json", "2026-08-19T08:00:00.000Z");
    expect(json.filename).toBe("notes-2026-08-19.json");
    expect(JSON.parse(json.body).count).toBe(1);
    const md = renderNotesExport(notes, "md", "2026-08-19T08:00:00.000Z");
    expect(md.filename).toBe("notes-2026-08-19.md");
    expect(md.body).toContain("Count: 1");
  });

  it("triggers a file download", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:notes");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadText(
      "notes-2026-08-19.json",
      '{"count":1}\n',
      "application/json;charset=utf-8",
    );

    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:notes");
    vi.useRealTimers();
  });
});
