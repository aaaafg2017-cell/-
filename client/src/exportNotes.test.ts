import { describe, expect, it, vi } from "vitest";
import {
  buildNotesExportFilename,
  buildNotesExportPayload,
  exportNotes,
  type ExportNotesOptions,
} from "./exportNotes.ts";
import type { Note } from "./api.ts";

const sampleNote: Note = {
  id: "1",
  title: "Buy milk",
  body: "2 liters",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
};

describe("buildNotesExportFilename", () => {
  it("uses the export date in the filename", () => {
    expect(buildNotesExportFilename("2026-08-19T12:34:56.789Z")).toBe(
      "notes-2026-08-19.json",
    );
  });
});

describe("exportNotes", () => {
  it("downloads a JSON payload with metadata and notes", () => {
    const download = vi.fn();
    const exportedAt = "2026-08-19T12:00:00.000Z";
    const options: ExportNotesOptions = {
      notes: [sampleNote],
      exportedAt,
      download,
    };

    exportNotes(options);

    expect(download).toHaveBeenCalledTimes(1);
    const [blob, filename] = download.mock.calls[0] as [Blob, string];
    expect(filename).toBe("notes-2026-08-19.json");
    expect(blob.type).toBe("application/json;charset=utf-8");
  });

  it("builds a stable JSON payload", () => {
    expect(
      buildNotesExportPayload([sampleNote], "2026-08-19T12:00:00.000Z"),
    ).toEqual({
      exportedAt: "2026-08-19T12:00:00.000Z",
      notes: [sampleNote],
    });
  });
});
