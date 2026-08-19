export interface NoteLike {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotesExport {
  exportedAt: string;
  count: number;
  notes: NoteLike[];
}

export type ExportFormat = "json" | "md";

export function parseExportFormat(value: unknown): ExportFormat | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === "") {
    return "json";
  }
  const format = String(raw).trim().toLowerCase();
  if (format === "json") {
    return "json";
  }
  if (format === "md" || format === "markdown") {
    return "md";
  }
  return undefined;
}

export function exportFilename(format: ExportFormat, exportedAt: string): string {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(exportedAt)?.[0] ?? "export";
  return `notes-${day}.${format}`;
}

function markdownHeadingTitle(title: string): string {
  const compact = title.replace(/\s+/g, " ").trim() || "Untitled";
  return compact.replace(/^#+/, (hashes) => `\\${hashes}`);
}

export function notesToJson(notes: NoteLike[], exportedAt: string): string {
  const payload: NotesExport = {
    exportedAt,
    count: notes.length,
    notes,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function notesToMarkdown(notes: NoteLike[], exportedAt: string): string {
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
  notes: NoteLike[],
  format: ExportFormat,
  exportedAt = new Date().toISOString(),
): { body: string; filename: string; contentType: string } {
  const filename = exportFilename(format, exportedAt);
  if (format === "md") {
    return {
      body: notesToMarkdown(notes, exportedAt),
      filename,
      contentType: "text/markdown; charset=utf-8",
    };
  }
  return {
    body: notesToJson(notes, exportedAt),
    filename,
    contentType: "application/json; charset=utf-8",
  };
}
