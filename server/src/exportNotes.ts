import type { Note } from "./notesStore.js";

export type ExportFormat = "json" | "markdown";

export function parseExportFormat(value: unknown): ExportFormat | undefined {
  if (value === undefined || value === null || value === "") {
    return "json";
  }
  if (value === "json" || value === "markdown") {
    return value;
  }
  if (value === "md") {
    return "markdown";
  }
  return undefined;
}

export function formatNotesJson(notes: Note[]): string {
  return `${JSON.stringify(notes, null, 2)}\n`;
}

export function formatNotesMarkdown(notes: Note[]): string {
  if (notes.length === 0) {
    return "";
  }
  return `${notes.map(formatNoteMarkdown).join("\n\n---\n\n")}\n`;
}

export function formatNoteMarkdown(note: Note): string {
  const title = note.title.replace(/\s+/g, " ").trim();
  const meta = `<!-- id: ${note.id} | created: ${note.createdAt} | updated: ${note.updatedAt} -->`;
  return note.body ? `# ${title}\n\n${meta}\n\n${note.body}` : `# ${title}\n\n${meta}`;
}

export function notesExportFilename(
  format: ExportFormat,
  now: Date = new Date(),
): string {
  const day = now.toISOString().slice(0, 10);
  return format === "json" ? `notes-${day}.json` : `notes-${day}.md`;
}

export function exportContentType(format: ExportFormat): string {
  return format === "json"
    ? "application/json; charset=utf-8"
    : "text/markdown; charset=utf-8";
}
