import type { Note } from "./api.ts";

export type ExportFormat = "json" | "markdown";

export function formatNotesJson(notes: Note[]): string {
  return `${JSON.stringify(notes, null, 2)}\n`;
}

export function formatNoteJson(note: Note): string {
  return `${JSON.stringify(note, null, 2)}\n`;
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

function sanitizeFilename(title: string): string {
  const stripped = [...title]
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 32 || '<>:"/\\|?*'.includes(ch) ? "-" : ch;
    })
    .join("")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 60) || "note";
}

export function noteExportFilename(note: Note, format: ExportFormat): string {
  const base = sanitizeFilename(note.title);
  return format === "json" ? `${base}.json` : `${base}.md`;
}

export function exportMimeType(format: ExportFormat): string {
  return format === "json"
    ? "application/json;charset=utf-8"
    : "text/markdown;charset=utf-8";
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
