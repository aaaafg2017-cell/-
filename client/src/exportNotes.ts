import type { Note } from "./api.ts";

export interface ExportNotesOptions {
  notes: Note[];
  exportedAt?: string;
  download?: (blob: Blob, filename: string) => void;
}

function defaultDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildNotesExportFilename(exportedAt: string): string {
  const day = exportedAt.slice(0, 10);
  return `notes-${day}.json`;
}

export function buildNotesExportPayload(notes: Note[], exportedAt: string) {
  return {
    exportedAt,
    notes,
  };
}

export function exportNotes({
  notes,
  exportedAt = new Date().toISOString(),
  download = defaultDownload,
}: ExportNotesOptions): void {
  const payload = buildNotesExportPayload(notes, exportedAt);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  download(blob, buildNotesExportFilename(exportedAt));
}
