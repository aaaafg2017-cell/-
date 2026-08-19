import type { Note } from "./api.ts";

export interface NotesExport {
  exportedAt: string;
  count: number;
  notes: Note[];
}

export type ExportFormat = "json" | "md";

export function exportFilename(format: ExportFormat, exportedAt: string): string {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(exportedAt)?.[0] ?? "export";
  return `notes-${day}.${format}`;
}

function markdownHeadingTitle(title: string): string {
  const compact = title.replace(/\s+/g, " ").trim() || "Untitled";
  return compact.replace(/^#+/, (hashes) => `\\${hashes}`);
}

export function notesToJson(notes: Note[], exportedAt: string): string {
  const payload: NotesExport = {
    exportedAt,
    count: notes.length,
    notes,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function notesToMarkdown(notes: Note[], exportedAt: string): string {
  const lines = [
    "# Notes",
    "",
    `Exported: ${exportedAt}`,
    `Count: ${notes.length}`,
    "",
  ];
  if (notes.length === 0) {
    lines.push("_No notes._", "");
    return lines.join("\n");
  }
  for (const [index, note] of notes.entries()) {
    if (index > 0) {
      lines.push("---", "");
    }
    lines.push(`## ${markdownHeadingTitle(note.title)}`);
    lines.push("");
    if (note.body.trim()) {
      lines.push(note.body, "");
    }
    lines.push(`- id: \`${note.id}\``);
    lines.push(`- created: ${note.createdAt}`);
    lines.push(`- updated: ${note.updatedAt}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function renderNotesExport(
  notes: Note[],
  format: ExportFormat,
  exportedAt = new Date().toISOString(),
): { body: string; filename: string; mime: string } {
  const filename = exportFilename(format, exportedAt);
  if (format === "md") {
    return {
      body: notesToMarkdown(notes, exportedAt),
      filename,
      mime: "text/markdown;charset=utf-8",
    };
  }
  return {
    body: notesToJson(notes, exportedAt),
    filename,
    mime: "application/json;charset=utf-8",
  };
}

export function downloadText(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  // Firefox can abort the download if the blob URL is revoked in the same turn.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
