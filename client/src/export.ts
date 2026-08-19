import type { Note } from "./api.ts";

export const EXPORT_FORMAT_VERSION = 1;
export const EXPORT_MIME_TYPE = "application/json;charset=utf-8";

export interface NotesExport {
  version: number;
  exportedAt: string;
  count: number;
  notes: Note[];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Newest note first, matching the order the list is rendered in.
 */
export function buildNotesExport(notes: Note[], exportedAt = new Date()): NotesExport {
  const ordered = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    version: EXPORT_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    count: ordered.length,
    notes: ordered.map((note) => ({
      id: note.id,
      title: note.title,
      body: note.body,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })),
  };
}

export function serializeNotes(notes: Note[], exportedAt = new Date()): string {
  return `${JSON.stringify(buildNotesExport(notes, exportedAt), null, 2)}\n`;
}

/**
 * Uses local calendar date so the filename matches the day the user sees.
 */
export function exportFilename(exportedAt = new Date()): string {
  const stamp = `${exportedAt.getFullYear()}-${pad(exportedAt.getMonth() + 1)}-${pad(
    exportedAt.getDate(),
  )}`;
  return `notes-${stamp}.json`;
}

export function downloadTextFile(
  filename: string,
  contents: string,
  type: string,
  doc: Document = document,
): void {
  if (typeof URL.createObjectURL !== "function") {
    throw new Error("downloads are not supported in this browser");
  }
  const revoke = URL.revokeObjectURL.bind(URL);
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  doc.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Firefox aborts an in-flight download when the URL is revoked synchronously.
    setTimeout(() => revoke(url), 0);
  }
}

export function downloadNotes(notes: Note[], exportedAt = new Date()): void {
  downloadTextFile(
    exportFilename(exportedAt),
    serializeNotes(notes, exportedAt),
    EXPORT_MIME_TYPE,
  );
}
